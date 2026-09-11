"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyActionPermission } from "@/lib/society-auth";
import { finalizeRequirement } from "@/lib/work-order";
import { matchVendors } from "@/lib/matching";
import {
  notifyApprovalRequested,
  notifyReturnedToManager,
  notifyRequirementMatched,
  notifyBidUploadedOnBehalf,
} from "@/lib/notifications";
import { OB_ROLES, MIN_ACTIVE_OFFICE_BEARERS, countActiveOfficeBearers } from "@/lib/society-ob";
import { formatDate } from "@/lib/date";
import { getBaseUrl } from "@/lib/base-url";
import { revalidatePath } from "next/cache";
import type { ExtractedBid } from "@/lib/ai";
import { extractBidFromUploadedDocument } from "@/lib/bid-document-extraction";
import { isValidGstin, calcLineItemAmounts } from "@/lib/gst";
import type { BidLineItemInput } from "@/app/vendor/[id]/requirements/[reqId]/actions";

export interface RequirementEditInput {
  categoryIds: string[];
  name: string;
  description: string;
  bidDeadline: string;
}

/**
 * Full edit (name/categories/description/deadline) — distinct from the
 * inline rename (updateRequirementName) and from ExtendDeadlineButton
 * (which specifically reopens an already-closed requirement, without
 * touching name/categories/description). Only allowed while the
 * requirement is still OPEN and no vendor has quoted yet — a passed
 * deadline doesn't lock it (0 quotes means nothing was priced against the
 * old version), but once a Bid exists, it was priced against the
 * requirement as originally written, so changing anything underneath it
 * would invalidate that quote silently.
 */
export async function updateRequirement(
  societyId: string,
  requirementId: string,
  input: RequirementEditInput,
): Promise<{ error: string } | undefined> {
  await requireSocietyActionPermission(societyId, PERMISSIONS.CREATE_REQUIREMENT);

  const requirement = await prisma.requirement.findUnique({
    where: { id: requirementId },
    include: { bids: { select: { id: true } }, invites: { select: { vendorCompanyId: true } } },
  });
  if (!requirement || requirement.societyId !== societyId) return { error: "Requirement not found." };
  if (requirement.status !== "OPEN") return { error: "This requirement can no longer be edited." };
  if (requirement.bids.length > 0) {
    return { error: "A vendor has already submitted a quote — this requirement can no longer be edited." };
  }

  if (
    !input.categoryIds.length ||
    !input.name.trim() ||
    !input.description.trim() ||
    !input.bidDeadline
  ) {
    return { error: "Project name, at least one category, description, and deadline are required." };
  }

  const bidDeadline = new Date(input.bidDeadline);
  if (bidDeadline.getTime() <= Date.now()) {
    return { error: "Bid deadline must be in the future." };
  }

  const society = await prisma.society.findUniqueOrThrow({
    where: { id: societyId },
    select: { name: true, cityId: true },
  });

  const updated = await prisma.requirement.update({
    where: { id: requirementId },
    data: {
      categories: { set: input.categoryIds.map((id) => ({ id })) },
      name: input.name.trim(),
      description: input.description.trim(),
      bidDeadline,
    },
    include: { categories: true },
  });

  // Categories may have changed — invite any newly-matching vendors, same
  // as extendRequirementDeadline. Never un-invites: a vendor already
  // notified stays invited even if a category they don't service was
  // removed, rather than yanking access mid-flow.
  const alreadyInvited = new Set(requirement.invites.map((inv) => inv.vendorCompanyId));
  const matched = await matchVendors(
    input.categoryIds,
    society.cityId,
  );
  const newlyMatched = matched.filter((v) => !alreadyInvited.has(v.id));

  if (newlyMatched.length > 0) {
    await prisma.requirementInvite.createMany({
      data: newlyMatched.map((v) => ({ requirementId, vendorCompanyId: v.id })),
      skipDuplicates: true,
    });

    const base = getBaseUrl();
    const categoryNames = updated.categories.map((c) => c.name).join(", ");
    try {
      await Promise.all(
        newlyMatched.map((v) =>
          notifyRequirementMatched({
            vendorEmail: v.ownerEmail,
            vendorPhone: v.ownerPhone,
            vendorName: v.name,
            categoryName: categoryNames,
            societyName: society.name,
            requirementTitle: updated.name,
            deadline: bidDeadline,
            reviewUrl: `${base}/vendor/${v.id}/requirements/${requirementId}`,
          }),
        ),
      );
    } catch (err) {
      console.error("Failed to notify newly matched vendors after requirement edit:", err);
    }
  }

  revalidatePath(`/society/${societyId}/requirements/${requirementId}`);
  revalidatePath(`/society/${societyId}/requirements`);
  redirect(`/society/${societyId}/requirements/${requirementId}`);
}

/**
 * Inline rename from the requirement detail page — same permission as
 * raising the requirement (Manager or Office Bearer, CREATE_REQUIREMENT).
 * Same locked-after-first-quote rule as updateRequirement, for consistency
 * (the UI already hides the input once ineligible; this is the
 * defense-in-depth check server-side).
 */
export async function updateRequirementName(
  societyId: string,
  requirementId: string,
  name: string,
): Promise<{ error: string } | undefined> {
  await requireSocietyActionPermission(societyId, PERMISSIONS.CREATE_REQUIREMENT);

  const trimmed = name.trim();
  if (!trimmed) return { error: "Project name can't be empty." };

  const requirement = await prisma.requirement.findUnique({
    where: { id: requirementId },
    include: { bids: { select: { id: true } } },
  });
  if (!requirement || requirement.societyId !== societyId) return { error: "Requirement not found." };
  if (requirement.status !== "OPEN" || requirement.bids.length > 0) {
    return { error: "This requirement can no longer be edited." };
  }

  await prisma.requirement.update({ where: { id: requirementId }, data: { name: trimmed } });
  revalidatePath(`/society/${societyId}/requirements/${requirementId}`);
  revalidatePath(`/society/${societyId}/requirements`);
}

/**
 * Reopens a requirement that closed with fewer than 3 quotes by pushing its
 * deadline out, then re-runs the matching engine — a vendor who registered,
 * or edited their profile, after the original deadline passed would
 * otherwise never get invited even though they now qualify.
 */
export async function extendRequirementDeadline(
  societyId: string,
  requirementId: string,
  newDeadline: string,
): Promise<{ error: string } | undefined> {
  await requireSocietyActionPermission(societyId, PERMISSIONS.CREATE_REQUIREMENT);

  const requirement = await prisma.requirement.findUnique({
    where: { id: requirementId },
    include: { categories: true, bids: { select: { id: true } }, invites: { select: { vendorCompanyId: true } } },
  });
  if (!requirement || requirement.societyId !== societyId) return { error: "Requirement not found." };
  if (requirement.status !== "OPEN") return { error: "This requirement can no longer be extended." };
  if (requirement.bidDeadline.getTime() > Date.now()) {
    return { error: "This requirement's deadline hasn't passed yet." };
  }
  if (requirement.bids.length >= 3) {
    return { error: "This requirement already has 3 quotes — it can't be extended further." };
  }

  const deadline = new Date(newDeadline);
  if (!newDeadline || Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
    return { error: "Enter a valid deadline in the future." };
  }

  await prisma.requirement.update({ where: { id: requirementId }, data: { bidDeadline: deadline } });

  const society = await prisma.society.findUniqueOrThrow({
    where: { id: societyId },
    select: { name: true, cityId: true },
  });
  const alreadyInvited = new Set(requirement.invites.map((inv) => inv.vendorCompanyId));
  const matched = await matchVendors(
    requirement.categories.map((c) => c.id),
    society.cityId,
  );
  const newlyMatched = matched.filter((v) => !alreadyInvited.has(v.id));

  if (newlyMatched.length > 0) {
    await prisma.requirementInvite.createMany({
      data: newlyMatched.map((v) => ({ requirementId, vendorCompanyId: v.id })),
      skipDuplicates: true,
    });

    const base = getBaseUrl();
    const categoryNames = requirement.categories.map((c) => c.name).join(", ");
    try {
      await Promise.all(
        newlyMatched.map((v) =>
          notifyRequirementMatched({
            vendorEmail: v.ownerEmail,
            vendorPhone: v.ownerPhone,
            vendorName: v.name,
            categoryName: categoryNames,
            societyName: society.name,
            requirementTitle: requirement.name,
            deadline,
            reviewUrl: `${base}/vendor/${v.id}/requirements/${requirementId}`,
          }),
        ),
      );
    } catch (err) {
      console.error("Failed to notify newly matched vendors after deadline extension:", err);
    }
  }

  revalidatePath(`/society/${societyId}/requirements/${requirementId}`);
  revalidatePath(`/society/${societyId}/requirements`);
}

/**
 * Manager recommends a winning bid (society-portal-spec.md Section 6). If
 * it isn't the lowest submitted bid, a justification note is mandatory and
 * becomes part of the permanent record. Below the society's approval
 * threshold, this finalizes immediately (Section 7); at/above threshold, it
 * opens a fresh round of 2-of-3 Office Bearer voting. Also used to
 * re-recommend after a RETURNED_TO_MANAGER (2 rejections) — old votes never
 * carry over to a new recommendation.
 */
export async function recommendBid(
  societyId: string,
  requirementId: string,
  bidId: string,
  justification: string,
): Promise<{ error: string } | undefined> {
  await requireSocietyActionPermission(societyId, PERMISSIONS.RECOMMEND_BID);
  const session = await auth();
  if (!session) return { error: "Not authorized." };

  const requirement = await prisma.requirement.findUnique({
    where: { id: requirementId },
    include: { bids: true, society: true },
  });
  if (!requirement || requirement.societyId !== societyId) return { error: "Requirement not found." };
  if (requirement.bidDeadline.getTime() > Date.now()) {
    return { error: "Bidding hasn't closed yet." };
  }
  if (requirement.status !== "OPEN" && requirement.status !== "RETURNED_TO_MANAGER") {
    return { error: "This requirement already has an active or finalized recommendation." };
  }

  const bid = requirement.bids.find((b) => b.id === bidId);
  if (!bid) return { error: "Bid not found for this requirement." };

  const lowestAmount = requirement.bids.reduce(
    (min, b) => (b.totalAmount.lessThan(min) ? b.totalAmount : min),
    requirement.bids[0].totalAmount,
  );
  const isLowest = bid.totalAmount.equals(lowestAmount);
  if (!isLowest && !justification.trim()) {
    return { error: "This isn't the lowest bid — a justification note is required." };
  }

  // Requirement creation already guarantees >= 2 active OBs (see
  // society-ob.ts), but re-check here — before anything is written — in case
  // one was deactivated in between. Otherwise this bid would get recommended
  // and then stuck: an at/above-threshold recommendation with nobody able to
  // reach the 2 votes needed to resolve it.
  if (!bid.totalAmount.lessThan(requirement.society.approvalThreshold)) {
    const obCount = await countActiveOfficeBearers(societyId);
    if (obCount < MIN_ACTIVE_OFFICE_BEARERS) {
      return {
        error: `This society only has ${obCount} active Office Bearer${obCount === 1 ? "" : "s"} — at least ${MIN_ACTIVE_OFFICE_BEARERS} are needed to approve a bid at or above the threshold. Invite more from Members before recommending.`,
      };
    }
  }

  await prisma.$transaction([
    // Fresh recommendation round — clear any votes cast against a
    // previously superseded recommendation.
    prisma.quotationApproval.deleteMany({ where: { requirementId } }),
    prisma.requirement.update({
      where: { id: requirementId },
      data: {
        recommendedBidId: bidId,
        recommendationNote: isLowest ? null : justification.trim(),
        recommendedAt: new Date(),
        recommendedByUserId: session.user.id,
      },
    }),
  ]);

  const managerName = session.user.name ?? session.user.email ?? "the Manager";

  if (bid.totalAmount.lessThan(requirement.society.approvalThreshold)) {
    await finalizeRequirement({
      requirementId,
      winningBidId: bidId,
      finalizedVia: "AUTO_BELOW_THRESHOLD",
      approvalSummary: `Finalized by Manager ${managerName} — below the ₹${requirement.society.approvalThreshold} approval threshold.`,
    });
  } else {
    await prisma.requirement.update({ where: { id: requirementId }, data: { status: "AWAITING_APPROVAL" } });

    const obs = await prisma.roleAssignment.findMany({
      where: {
        entityType: "SOCIETY",
        entityId: societyId,
        role: { in: [...OB_ROLES] },
        status: "ACTIVE",
      },
      include: { user: true },
    });
    const base = getBaseUrl();
    try {
      await notifyApprovalRequested({
        recipients: obs.map((ra) => ra.user.email),
        societyName: requirement.society.name,
        requirementName: requirement.name,
        reviewUrl: `${base}/society/${societyId}/requirements/${requirementId}`,
      });
    } catch (err) {
      console.error("Failed to notify Office Bearers that a quotation needs approval:", err);
    }
  }

  revalidatePath(`/society/${societyId}/requirements/${requirementId}`);
  revalidatePath(`/society/${societyId}/requirements`);
  revalidatePath(`/society/${societyId}`);
}

/**
 * An Office Bearer's vote on the current recommendation. 2 approvals
 * finalizes; 2 rejections sends it back to the Manager to re-recommend
 * (society-portal-spec.md Section 7).
 */
export async function castQuotationVote(
  societyId: string,
  requirementId: string,
  decision: "APPROVED" | "REJECTED",
): Promise<{ error: string } | undefined> {
  await requireSocietyActionPermission(societyId, PERMISSIONS.APPROVE_REJECT_QUOTATION);
  const session = await auth();
  if (!session) return { error: "Not authorized." };

  const requirement = await prisma.requirement.findUnique({
    where: { id: requirementId },
    include: { bids: true, society: true },
  });
  if (!requirement || requirement.societyId !== societyId) return { error: "Requirement not found." };
  if (requirement.status !== "AWAITING_APPROVAL") {
    return { error: "This requirement isn't awaiting your vote." };
  }

  await prisma.quotationApproval.upsert({
    where: {
      requirementId_officeBearerUserId: { requirementId, officeBearerUserId: session.user.id },
    },
    update: { decision, decidedAt: new Date() },
    create: { requirementId, officeBearerUserId: session.user.id, decision },
  });

  const votes = await prisma.quotationApproval.findMany({ where: { requirementId } });
  const approvals = votes.filter((v) => v.decision === "APPROVED").length;
  const rejections = votes.filter((v) => v.decision === "REJECTED").length;

  if (approvals >= 2) {
    const approverNames = votes.filter((v) => v.decision === "APPROVED");
    const approverUsers = await prisma.user.findMany({
      where: { id: { in: approverNames.map((v) => v.officeBearerUserId) } },
    });
    const summary = `Approved by ${approverUsers.map((u) => u.name ?? u.email).join(", ")} on ${formatDate(new Date())}.`;
    if (!requirement.recommendedBidId) return { error: "No recommended bid to finalize." };
    await finalizeRequirement({
      requirementId,
      winningBidId: requirement.recommendedBidId,
      finalizedVia: "OB_APPROVAL",
      approvalSummary: summary,
    });
  } else if (rejections >= 2) {
    // Clear the (now-rejected) recommendation so the bid comparison view
    // reopens cleanly for the Manager to pick again — see recommendBid,
    // which also wipes stale votes on the next recommendation.
    await prisma.requirement.update({
      where: { id: requirementId },
      data: {
        status: "RETURNED_TO_MANAGER",
        recommendedBidId: null,
        recommendationNote: null,
        recommendedAt: null,
        recommendedByUserId: null,
      },
    });

    const manager = await prisma.roleAssignment.findFirst({
      where: { entityType: "SOCIETY", entityId: societyId, role: "MANAGER", status: "ACTIVE" },
      include: { user: true },
    });
    if (manager) {
      const base = getBaseUrl();
      try {
        await notifyReturnedToManager({
          managerEmail: manager.user.email,
          societyName: requirement.society.name,
          requirementName: requirement.name,
          reviewUrl: `${base}/society/${societyId}/requirements/${requirementId}`,
        });
      } catch (err) {
        console.error("Failed to notify Manager that the requirement was returned:", err);
      }
    }
  }

  revalidatePath(`/society/${societyId}/requirements/${requirementId}`);
  revalidatePath(`/society/${societyId}/requirements`);
  revalidatePath(`/society/${societyId}`);
}

async function assertUploadEligible(societyId: string, requirementId: string, vendorCompanyId: string) {
  await requireSocietyActionPermission(societyId, PERMISSIONS.UPLOAD_BID_ON_BEHALF);

  const requirement = await prisma.requirement.findUnique({
    where: { id: requirementId },
    select: { societyId: true, bidDeadline: true, status: true },
  });
  if (!requirement || requirement.societyId !== societyId) throw new Error("Requirement not found.");
  if (requirement.status !== "OPEN") throw new Error("This requirement is no longer accepting quotes.");
  if (requirement.bidDeadline.getTime() <= Date.now()) throw new Error("Bidding has closed for this requirement.");

  const invite = await prisma.requirementInvite.findUnique({
    where: { requirementId_vendorCompanyId: { requirementId, vendorCompanyId } },
  });
  if (!invite) throw new Error("This vendor hasn't been matched/invited to this requirement.");
}

/**
 * Downloads the just-uploaded document (see api/bid-documents/upload) and
 * runs it through Claude (lib/ai.ts extractBidFromDocument) to draft line
 * items + terms for the Manager to review — nothing is persisted as a Bid
 * here. Excel files are converted to text first (lib/spreadsheet-text.ts);
 * PDF/image go in as native document/image blocks.
 */
export async function extractBidDocument(
  societyId: string,
  requirementId: string,
  vendorCompanyId: string,
  documentUrl: string,
  contentType: string,
): Promise<{ extracted: ExtractedBid } | { error: string }> {
  try {
    await assertUploadEligible(societyId, requirementId, vendorCompanyId);
  } catch (err) {
    return { error: (err as Error).message };
  }

  return extractBidFromUploadedDocument(documentUrl, contentType);
}

export interface ManagerBidInput {
  lineItems: BidLineItemInput[];
  bidValidity: string;
  paymentTerms: string;
  warrantyPeriod: string;
  completionTime: string;
  notes: string;
  gstCompliant: boolean;
  gstNumber: string;
}

/**
 * Creates/updates the vendor's Bid from a Manager-reviewed, drag-and-dropped
 * quote document — same validation as the vendor's own submitBid (vendor/
 * [id]/requirements/[reqId]/actions.ts), but stamped MANAGER_UPLOAD with no
 * vendor-side login involved (submittedByUserId stays null; uploadedByUserId
 * is this Manager). Overwrites any existing Bid for this vendor/requirement
 * pair the same way a vendor's own resubmission would — once uploaded, it's
 * simply the vendor's quote of record until the deadline (product decision,
 * 2026-09-10), viewable/editable by the vendor from their own portal.
 */
export async function submitManagerBid(
  societyId: string,
  requirementId: string,
  vendorCompanyId: string,
  input: ManagerBidInput,
  sourceDocumentUrl: string,
): Promise<{ error: string } | undefined> {
  const session = await auth();
  if (!session) return { error: "Not authorized." };

  try {
    await assertUploadEligible(societyId, requirementId, vendorCompanyId);
  } catch (err) {
    return { error: (err as Error).message };
  }

  const requirement = await prisma.requirement.findUniqueOrThrow({
    where: { id: requirementId },
    select: { name: true, bidDeadline: true, society: { select: { name: true, gstNumber: true } } },
  });

  const gstNumber = input.gstNumber.trim().toUpperCase();
  if (input.gstCompliant && !isValidGstin(gstNumber)) {
    return { error: "Enter a valid 15-character GSTIN for a GST-compliant quote." };
  }

  const lineItems = input.lineItems
    .filter((li) => li.description.trim())
    .map((li) => {
      const quantity = Number(li.quantity);
      const unitRate = Number(li.unitRate);
      const gstRate = input.gstCompliant ? Number(li.gstRate) : null;
      const { amount, gstAmount } = calcLineItemAmounts({ quantity, unitRate, gstRate });
      return {
        description: li.description.trim(),
        quantity,
        unit: li.unit,
        unitRate,
        amount,
        gstRate,
        gstAmount,
      };
    });

  if (lineItems.length === 0) return { error: "Add at least one line item." };
  if (lineItems.some((li) => !Number.isFinite(li.quantity) || !Number.isFinite(li.unitRate))) {
    return { error: "Quantity and rate must be numbers." };
  }
  if (
    input.gstCompliant &&
    lineItems.some((li) => li.gstRate === null || !Number.isFinite(li.gstRate) || li.gstRate < 0 || li.gstRate > 100)
  ) {
    return { error: "Enter a GST % between 0 and 100 for every line item." };
  }
  if (!input.bidValidity) return { error: "Bid validity date is required." };

  const totalAmount = lineItems.reduce((sum, li) => sum + li.amount, 0);

  if (input.gstCompliant) {
    await prisma.vendorCompany.update({ where: { id: vendorCompanyId }, data: { gstNumber } });
  }

  const bid = await prisma.bid.upsert({
    where: { requirementId_vendorCompanyId: { requirementId, vendorCompanyId } },
    create: {
      requirementId,
      vendorCompanyId,
      submittedVia: "MANAGER_UPLOAD",
      uploadedByUserId: session.user.id,
      sourceDocumentUrl,
      totalAmount,
      bidValidity: new Date(input.bidValidity),
      paymentTerms: input.paymentTerms || null,
      warrantyPeriod: input.warrantyPeriod || null,
      completionTime: input.completionTime || null,
      notes: input.notes || null,
      gstCompliant: input.gstCompliant,
      vendorGstNumberSnapshot: input.gstCompliant ? gstNumber : null,
      societyGstNumberSnapshot: input.gstCompliant ? requirement.society.gstNumber : null,
      lineItems: { create: lineItems },
    },
    update: {
      submittedByUserId: null,
      submittedVia: "MANAGER_UPLOAD",
      uploadedByUserId: session.user.id,
      sourceDocumentUrl,
      totalAmount,
      bidValidity: new Date(input.bidValidity),
      paymentTerms: input.paymentTerms || null,
      warrantyPeriod: input.warrantyPeriod || null,
      completionTime: input.completionTime || null,
      notes: input.notes || null,
      gstCompliant: input.gstCompliant,
      vendorGstNumberSnapshot: input.gstCompliant ? gstNumber : null,
      societyGstNumberSnapshot: input.gstCompliant ? requirement.society.gstNumber : null,
      lineItems: { deleteMany: {}, create: lineItems },
    },
  });

  const vendor = await prisma.vendorCompany.findUniqueOrThrow({
    where: { id: vendorCompanyId },
    select: { name: true, ownerEmail: true, ownerPhone: true },
  });
  const base = getBaseUrl();
  const totalGst = lineItems.reduce((sum, li) => sum + (li.gstAmount ?? 0), 0);
  try {
    await notifyBidUploadedOnBehalf({
      vendorEmail: vendor.ownerEmail,
      vendorPhone: vendor.ownerPhone,
      vendorName: vendor.name,
      bidId: bid.id,
      requirementName: requirement.name,
      societyName: requirement.society.name,
      totalAmount: totalAmount.toFixed(2),
      gst: input.gstCompliant
        ? { subtotal: totalAmount.toFixed(2), totalGst: totalGst.toFixed(2), grandTotal: (totalAmount + totalGst).toFixed(2) }
        : undefined,
      managerName: session.user.name ?? session.user.email ?? "Your society's Manager",
      bidDeadline: requirement.bidDeadline,
      reviewUrl: `${base}/vendor/${vendorCompanyId}/requirements/${requirementId}`,
    });
  } catch (err) {
    console.error(`Failed to notify vendor ${vendorCompanyId} of manager-uploaded bid:`, err);
  }

  revalidatePath(`/society/${societyId}/requirements/${requirementId}`);
}
