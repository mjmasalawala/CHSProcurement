"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorActionPermission } from "@/lib/vendor-auth";
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
