"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyActionPermission } from "@/lib/society-auth";
import { finalizeRequirement } from "@/lib/work-order";
import { notifyApprovalRequested, notifyReturnedToManager } from "@/lib/notifications";
import { OB_ROLES, MIN_ACTIVE_OFFICE_BEARERS, countActiveOfficeBearers } from "@/lib/society-ob";
import { revalidatePath } from "next/cache";

/**
 * Inline rename from the requirement detail page — same permission as
 * raising the requirement (Manager or Office Bearer, CREATE_REQUIREMENT).
 */
export async function updateRequirementName(
  societyId: string,
  requirementId: string,
  name: string,
): Promise<{ error: string } | undefined> {
  await requireSocietyActionPermission(societyId, PERMISSIONS.CREATE_REQUIREMENT);

  const trimmed = name.trim();
  if (!trimmed) return { error: "Project name can't be empty." };

  const requirement = await prisma.requirement.findUnique({ where: { id: requirementId } });
  if (!requirement || requirement.societyId !== societyId) return { error: "Requirement not found." };

  await prisma.requirement.update({ where: { id: requirementId }, data: { name: trimmed } });
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
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    await notifyApprovalRequested({
      recipients: obs.map((ra) => ra.user.email),
      societyName: requirement.society.name,
      requirementName: requirement.name,
      reviewUrl: `${base}/society/${societyId}/requirements/${requirementId}`,
    });
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
    const summary = `Approved by ${approverUsers.map((u) => u.name ?? u.email).join(", ")} on ${new Date().toLocaleDateString()}.`;
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
      const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      await notifyReturnedToManager({
        managerEmail: manager.user.email,
        societyName: requirement.society.name,
        requirementName: requirement.name,
        reviewUrl: `${base}/society/${societyId}/requirements/${requirementId}`,
      });
    }
  }

  revalidatePath(`/society/${societyId}/requirements/${requirementId}`);
  revalidatePath(`/society/${societyId}/requirements`);
  revalidatePath(`/society/${societyId}`);
}
