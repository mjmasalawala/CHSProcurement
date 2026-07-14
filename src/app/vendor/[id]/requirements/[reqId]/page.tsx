import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorPagePermission } from "@/lib/vendor-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-badge";
import { formatDate, formatDateTime } from "@/lib/date";
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
          categories: true,
          society: { select: { name: true, address: true } },
          bids: { where: { vendorCompanyId: id }, include: { lineItems: true, workOrder: { select: { id: true } } } },
        },
      },
    },
  });

  if (!invite) notFound();

  const { requirement } = invite;
  const myBid = requirement.bids[0] ?? null;
  const closed = isClosed(requirement.bidDeadline);

  const myDraft = await prisma.bidDraft.findUnique({
    where: { requirementId_vendorCompanyId: { requirementId: reqId, vendorCompanyId: id } },
    include: { lineItems: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/vendor/${id}/requirements`}
        className="text-[13px] text-text-secondary underline hover:text-text-primary"
      >
        ← Back to Requirements
      </Link>

      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary">
          {requirement.name} — {requirement.society.name}
        </h1>
        <p className="text-[13px] text-text-secondary">{requirement.categories.map((c) => c.name).join(", ")}</p>
        <p className="text-[13px] text-text-tertiary">
          ID: {requirement.id} · Raised {formatDate(requirement.createdAt)}
        </p>
      </div>

      <Card className="flex flex-col gap-2">
        <p className="text-[15px] text-text-primary">{requirement.description}</p>
        <p className="text-[13px] text-text-secondary">Location: {requirement.society.address}</p>
        <p className="text-[13px] font-medium text-text-primary">
          Quote deadline: {formatDateTime(requirement.bidDeadline)} {closed && "(closed)"}
        </p>
      </Card>

      {closed ? (
        myBid ? (
          <Card className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-text-primary">
                Your quote: ₹{myBid.totalAmount.toString()}
              </p>
              <Badge tone={statusTone(myBid.status)}>{statusLabel(myBid.status)}</Badge>
            </div>
            {myBid.workOrder && (
              <a
                href={`/api/work-orders/${myBid.workOrder.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-[13px] text-accent-primary underline"
              >
                Download Work Order PDF
              </a>
            )}
          </Card>
        ) : (
          <p className="text-[13px] text-text-secondary">Quote submission closed — you did not submit a quote.</p>
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
          draft={
            myDraft
              ? {
                  bidValidity: myDraft.bidValidity,
                  notes: myDraft.notes,
                  lineItems: myDraft.lineItems.map((li) => ({
                    description: li.description,
                    quantity: li.quantity,
                    unit: li.unit,
                    unitRate: li.unitRate,
                  })),
                }
              : null
          }
          suggestDisabled={!!myDraft?.suggestionGeneratedAt}
        />
      )}
    </div>
  );
}
