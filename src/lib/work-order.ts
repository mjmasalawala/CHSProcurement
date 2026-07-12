import { prisma } from "@/lib/prisma";
import type { FinalizationMethod } from "@/generated/prisma/enums";
import { notifyFinalized, notifyBidOutcome } from "@/lib/notifications";

/**
 * Shared finalization path for both the below-threshold auto-finalize case
 * and the 2-of-3 Office Bearer approval case (society-portal-spec.md
 * Section 7-8 / work-order-pdf-spec.md). Snapshots the identity fields onto
 * the WorkOrder row so a historical Work Order stays exactly as issued even
 * if the Society or VendorCompany profile changes later.
 */
export async function finalizeRequirement(params: {
  requirementId: string;
  winningBidId: string;
  finalizedVia: FinalizationMethod;
  approvalSummary: string;
}) {
  const requirement = await prisma.requirement.findUniqueOrThrow({
    where: { id: params.requirementId },
    include: {
      society: { include: { city: true } },
      bids: { include: { vendorCompany: true } },
    },
  });

  const winningBid = requirement.bids.find((b) => b.id === params.winningBidId);
  if (!winningBid) throw new Error("Winning bid not found on this requirement.");

  const sequence =
    (await prisma.workOrder.count({ where: { requirement: { societyId: requirement.societyId } } })) + 1;
  const workOrderNumber = `WO-${requirement.societyId.slice(0, 8).toUpperCase()}-${String(sequence).padStart(4, "0")}`;

  const [workOrder] = await prisma.$transaction([
    prisma.workOrder.create({
      data: {
        requirementId: requirement.id,
        bidId: winningBid.id,
        workOrderNumber,
        finalizedVia: params.finalizedVia,
        approvalSummary: params.approvalSummary,
        justificationNote: requirement.recommendationNote,
        societyNameSnapshot: requirement.society.name,
        societyAddressSnapshot: `${requirement.society.address}, ${requirement.society.city.name}`,
        vendorNameSnapshot: winningBid.vendorCompany.name,
        vendorAddressSnapshot: winningBid.vendorCompany.registeredAddress,
        vendorContactSnapshot: `${winningBid.vendorCompany.ownerName} · ${winningBid.vendorCompany.ownerPhone} · ${winningBid.vendorCompany.ownerEmail}`,
      },
    }),
    prisma.bid.update({ where: { id: winningBid.id }, data: { status: "WON" } }),
    prisma.bid.updateMany({
      where: { requirementId: requirement.id, id: { not: winningBid.id } },
      data: { status: "NOT_SELECTED" },
    }),
    prisma.requirement.update({
      where: { id: requirement.id },
      data: { status: "FINALIZED", finalizedAt: new Date() },
    }),
  ]);

  const obs = await prisma.roleAssignment.findMany({
    where: {
      entityType: "SOCIETY",
      entityId: requirement.societyId,
      role: { in: ["MANAGER", "CHAIRMAN", "SECRETARY", "TREASURER"] },
      status: "ACTIVE",
    },
    include: { user: true },
  });

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const reviewUrl = `${base}/society/${requirement.societyId}/requirements/${requirement.id}`;

  await notifyFinalized({
    recipients: obs.map((ra) => ra.user.email),
    societyName: requirement.society.name,
    requirementName: requirement.name,
    workOrderNumber,
    reviewUrl,
  });

  await Promise.all(
    requirement.bids.map((bid) =>
      notifyBidOutcome({
        vendorEmail: bid.vendorCompany.ownerEmail,
        requirementName: requirement.name,
        won: bid.id === winningBid.id,
      }),
    ),
  );

  return workOrder;
}
