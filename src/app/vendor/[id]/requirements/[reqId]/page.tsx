import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorPagePermission } from "@/lib/vendor-auth";
import { Card } from "@/components/ui/card";
import { BidForm } from "./bid-form";

export const dynamic = "force-dynamic";

function isClosed(deadline: Date): boolean {
  return deadline.getTime() <= Date.now();
}

export default async function RequirementDetailPage({
  params,
}: {
  params: Promise<{ id: string; reqId: string }>;
}) {
  const { id, reqId } = await params;
  await requireVendorPagePermission(id, PERMISSIONS.VIEW_REQUIREMENTS_INBOX, `/vendor/${id}/requirements/${reqId}`);

  const invite = await prisma.requirementInvite.findUnique({
    where: { requirementId_vendorCompanyId: { requirementId: reqId, vendorCompanyId: id } },
    include: {
      requirement: {
        include: {
          category: true,
          society: { select: { name: true, address: true } },
          bids: { where: { vendorCompanyId: id }, include: { lineItems: true } },
        },
      },
    },
  });

  if (!invite) notFound();

  const { requirement } = invite;
  const myBid = requirement.bids[0] ?? null;
  const closed = isClosed(requirement.bidDeadline);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[24px] font-bold text-text-primary">
        {requirement.category.name} — {requirement.society.name}
      </h1>

      <Card className="flex flex-col gap-2">
        <p className="text-[15px] text-text-primary">{requirement.description}</p>
        <p className="text-[13px] text-text-secondary">Urgency: {requirement.urgency}</p>
        {requirement.budgetBand && (
          <p className="text-[13px] text-text-secondary">Budget band: {requirement.budgetBand}</p>
        )}
        <p className="text-[13px] text-text-secondary">Location: {requirement.society.address}</p>
        <p className="text-[13px] font-medium text-text-primary">
          Bid deadline: {requirement.bidDeadline.toLocaleString()} {closed && "(closed)"}
        </p>
      </Card>

      {closed ? (
        myBid ? (
          <Card>
            <p className="text-[15px] font-medium text-text-primary">Your bid: ₹{myBid.totalAmount.toString()}</p>
            <p className="text-[13px] text-text-secondary">Status: {myBid.status}</p>
          </Card>
        ) : (
          <p className="text-[13px] text-text-secondary">Bidding closed — you did not submit a bid.</p>
        )
      ) : (
        <BidForm
          vendorCompanyId={id}
          requirementId={reqId}
          existingBid={
            myBid
              ? {
                  bidValidity: myBid.bidValidity.toISOString().slice(0, 10),
                  notes: myBid.notes ?? "",
                  lineItems: myBid.lineItems.map((li) => ({
                    description: li.description,
                    quantity: li.quantity.toString(),
                    unit: li.unit,
                    unitRate: li.unitRate.toString(),
                  })),
                }
              : null
          }
        />
      )}
    </div>
  );
}
