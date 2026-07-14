"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorActionPermission } from "@/lib/vendor-auth";
import { suggestLineItems } from "@/lib/ai";
import { revalidatePath } from "next/cache";

export interface BidLineItemInput {
  description: string;
  quantity: string;
  unit: string;
  unitRate: string;
}

export interface SubmitBidInput {
  lineItems: BidLineItemInput[];
  bidValidity: string;
  notes: string;
}

export interface BidDraftInput {
  lineItems: BidLineItemInput[];
  bidValidity: string;
  notes: string;
}

/**
 * Drafts line items from the requirement's description via Claude
 * (lib/ai.ts) for the vendor to review/edit before submitting — never
 * suggests a price, only description/quantity/unit. Capped at once per
 * requirement/vendor pair (to bound API spend): a successful call stamps
 * BidDraft.suggestionGeneratedAt, which the caller checks first — a repeat
 * call (e.g. a stale client, or the button somehow re-enabled) is rejected
 * server-side rather than re-billing the AI call. A failed attempt leaves no
 * stamp, so the vendor can freely retry.
 */
export async function suggestBidLineItems(
  vendorCompanyId: string,
  requirementId: string,
): Promise<{ lineItems: { description: string; quantity: string; unit: string }[] } | { error: string }> {
  await requireVendorActionPermission(vendorCompanyId, PERMISSIONS.SUBMIT_BID);

  const invited = await prisma.requirementInvite.findUnique({
    where: { requirementId_vendorCompanyId: { requirementId, vendorCompanyId } },
  });
  if (!invited) return { error: "You were not invited to bid on this requirement." };

  const existingDraft = await prisma.bidDraft.findUnique({
    where: { requirementId_vendorCompanyId: { requirementId, vendorCompanyId } },
    select: { suggestionGeneratedAt: true },
  });
  if (existingDraft?.suggestionGeneratedAt) {
    return { error: "Suggestions have already been generated for this quote." };
  }

  const requirement = await prisma.requirement.findUniqueOrThrow({
    where: { id: requirementId },
    select: { description: true, categories: { select: { name: true } } },
  });

  try {
    const lineItems = await suggestLineItems(
      requirement.description,
      requirement.categories.map((c) => c.name).join(", "),
    );

    await prisma.bidDraft.upsert({
      where: { requirementId_vendorCompanyId: { requirementId, vendorCompanyId } },
      create: {
        requirementId,
        vendorCompanyId,
        suggestionGeneratedAt: new Date(),
        lineItems: { create: lineItems.map((li) => ({ ...li, unitRate: "" })) },
      },
      update: {
        suggestionGeneratedAt: new Date(),
        lineItems: { deleteMany: {}, create: lineItems.map((li) => ({ ...li, unitRate: "" })) },
      },
    });
    revalidatePath(`/vendor/${vendorCompanyId}/requirements/${requirementId}`);

    return { lineItems };
  } catch (err) {
    console.error(`Failed to suggest line items for requirement ${requirementId}:`, err);
    return { error: "Couldn't generate suggestions this time. Please add line items manually." };
  }
}

/**
 * Explicit "Save Draft Quote" — persists the vendor's in-progress quote
 * (line items, validity, notes) to BidDraft so it survives navigating away
 * before the real Submit. Kept separate from Bid entirely (see
 * prisma/schema.prisma BidDraft comment) so an unsubmitted draft never shows
 * up anywhere a real quote is read.
 */
export async function saveBidDraft(
  vendorCompanyId: string,
  requirementId: string,
  input: BidDraftInput,
): Promise<{ error: string } | undefined> {
  await requireVendorActionPermission(vendorCompanyId, PERMISSIONS.SUBMIT_BID);

  const invited = await prisma.requirementInvite.findUnique({
    where: { requirementId_vendorCompanyId: { requirementId, vendorCompanyId } },
  });
  if (!invited) return { error: "You were not invited to bid on this requirement." };

  await prisma.bidDraft.upsert({
    where: { requirementId_vendorCompanyId: { requirementId, vendorCompanyId } },
    create: {
      requirementId,
      vendorCompanyId,
      bidValidity: input.bidValidity,
      notes: input.notes,
      lineItems: { create: input.lineItems },
    },
    update: {
      bidValidity: input.bidValidity,
      notes: input.notes,
      lineItems: { deleteMany: {}, create: input.lineItems },
    },
  });

  revalidatePath(`/vendor/${vendorCompanyId}/requirements/${requirementId}`);
}

/**
 * Upserts the vendor company's one Bid for this Requirement — line items are
 * fully replaced on each save, so editing before the deadline just means
 * resubmitting the whole form (vendor-registration-portal-spec.md Section 8).
 */
export async function submitBid(
  vendorCompanyId: string,
  requirementId: string,
  input: SubmitBidInput,
): Promise<{ error: string } | undefined> {
  await requireVendorActionPermission(vendorCompanyId, PERMISSIONS.SUBMIT_BID);
  const session = await auth();
  if (!session) return { error: "Not authorized." };

  const invited = await prisma.requirementInvite.findUnique({
    where: { requirementId_vendorCompanyId: { requirementId, vendorCompanyId } },
  });
  if (!invited) return { error: "You were not invited to bid on this requirement." };

  const requirement = await prisma.requirement.findUniqueOrThrow({ where: { id: requirementId } });
  if (requirement.bidDeadline.getTime() <= Date.now()) {
    return { error: "Bidding has closed for this requirement." };
  }

  const lineItems = input.lineItems
    .filter((li) => li.description.trim())
    .map((li) => {
      const quantity = Number(li.quantity);
      const unitRate = Number(li.unitRate);
      return {
        description: li.description.trim(),
        quantity,
        unit: li.unit,
        unitRate,
        amount: quantity * unitRate,
      };
    });

  if (lineItems.length === 0) return { error: "Add at least one line item." };
  if (lineItems.some((li) => !Number.isFinite(li.quantity) || !Number.isFinite(li.unitRate))) {
    return { error: "Quantity and rate must be numbers." };
  }
  if (!input.bidValidity) return { error: "Bid validity date is required." };

  const totalAmount = lineItems.reduce((sum, li) => sum + li.amount, 0);

  await prisma.bid.upsert({
    where: { requirementId_vendorCompanyId: { requirementId, vendorCompanyId } },
    create: {
      requirementId,
      vendorCompanyId,
      submittedByUserId: session.user.id,
      totalAmount,
      bidValidity: new Date(input.bidValidity),
      notes: input.notes || null,
      lineItems: { create: lineItems },
    },
    update: {
      submittedByUserId: session.user.id,
      totalAmount,
      bidValidity: new Date(input.bidValidity),
      notes: input.notes || null,
      lineItems: { deleteMany: {}, create: lineItems },
    },
  });

  revalidatePath(`/vendor/${vendorCompanyId}/requirements/${requirementId}`);
  revalidatePath(`/vendor/${vendorCompanyId}/requirements`);
  revalidatePath(`/vendor/${vendorCompanyId}/bids`);
}
