"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyActionPermission } from "@/lib/society-auth";
import { revalidatePath } from "next/cache";

/**
 * Manager recommends a winning bid (society-portal-spec.md Section 6). If
 * it isn't the lowest submitted bid, a justification note is mandatory and
 * becomes part of the permanent record. Approval/finalization/Work Order
 * generation is M6 — this only records the recommendation.
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
    include: { bids: true },
  });
  if (!requirement || requirement.societyId !== societyId) return { error: "Requirement not found." };
  if (requirement.bidDeadline.getTime() > Date.now()) {
    return { error: "Bidding hasn't closed yet." };
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

  await prisma.requirement.update({
    where: { id: requirementId },
    data: {
      recommendedBidId: bidId,
      recommendationNote: isLowest ? null : justification.trim(),
      recommendedAt: new Date(),
      recommendedByUserId: session.user.id,
    },
  });

  revalidatePath(`/society/${societyId}/requirements/${requirementId}`);
  revalidatePath(`/society/${societyId}/requirements`);
}
