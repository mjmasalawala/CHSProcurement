import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyPagePermission } from "@/lib/society-auth";
import { Card } from "@/components/ui/card";
import { BidComparison } from "./bid-comparison";

export const dynamic = "force-dynamic";

function isClosed(deadline: Date): boolean {
  return deadline.getTime() <= Date.now();
}

export default async function SocietyRequirementDetailPage({
  params,
}: {
  params: Promise<{ id: string; reqId: string }>;
}) {
  const { id, reqId } = await params;
  await requireSocietyPagePermission(
    id,
    PERMISSIONS.CREATE_REQUIREMENT,
    `/society/${id}/requirements/${reqId}`,
  );

  const requirement = await prisma.requirement.findUnique({
    where: { id: reqId },
    include: {
      category: true,
      invites: { include: { vendorCompany: { select: { name: true } } } },
      bids: {
        include: { vendorCompany: { select: { name: true } }, lineItems: true },
        orderBy: { totalAmount: "asc" },
      },
    },
  });

  if (!requirement || requirement.societyId !== id) notFound();

  const closed = isClosed(requirement.bidDeadline);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[24px] font-bold text-text-primary">{requirement.category.name}</h1>

      <Card className="flex flex-col gap-2">
        <p className="text-[15px] text-text-primary">{requirement.description}</p>
        <p className="text-[13px] text-text-secondary">Urgency: {requirement.urgency}</p>
        {requirement.budgetBand && (
          <p className="text-[13px] text-text-secondary">Budget band: {requirement.budgetBand}</p>
        )}
        <p className="text-[13px] font-medium text-text-primary">
          Bid deadline: {requirement.bidDeadline.toLocaleString()} {closed && "(closed)"}
        </p>
        <p className="text-[13px] text-text-secondary">
          {requirement.invites.length} vendors matched and invited:{" "}
          {requirement.invites.map((inv) => inv.vendorCompany.name).join(", ") || "none"}
        </p>
      </Card>

      {!closed ? (
        <p className="text-[13px] text-text-secondary">
          Bids stay blind until the deadline — check back once it closes to compare.
        </p>
      ) : requirement.bids.length === 0 ? (
        <p className="text-[13px] text-text-secondary">No bids were submitted for this requirement.</p>
      ) : (
        <BidComparison
          societyId={id}
          requirementId={reqId}
          bids={requirement.bids.map((b) => ({
            id: b.id,
            vendorName: b.vendorCompany.name,
            totalAmount: b.totalAmount.toString(),
            bidValidity: b.bidValidity.toISOString().slice(0, 10),
            notes: b.notes,
            lineItems: b.lineItems.map((li) => ({
              description: li.description,
              quantity: li.quantity.toString(),
              unit: li.unit,
              unitRate: li.unitRate.toString(),
              amount: li.amount.toString(),
            })),
          }))}
          recommendedBidId={requirement.recommendedBidId}
          recommendationNote={requirement.recommendationNote}
        />
      )}
    </div>
  );
}
