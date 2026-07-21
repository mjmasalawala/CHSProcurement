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
import { ContactDetails } from "./contact-details";

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
          society: {
            select: {
              name: true,
              address: true,
              registrantName: true,
              registrantPhone: true,
              registrantEmail: true,
              city: { select: { name: true } },
            },
          },
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
          {requirement.name} —{" "}
          {invite.contactRevealedAt ? requirement.society.name : `Society in ${requirement.society.city.name}`}
        </h1>
        <p className="text-[13px] text-text-secondary">{requirement.categories.map((c) => c.name).join(", ")}</p>
        <p className="text-[13px] text-text-tertiary">
          ID: {requirement.id} · Raised {formatDate(requirement.createdAt)}
        </p>
      </div>

      <Card className="flex flex-col gap-2">
        <p className="text-[15px] whitespace-pre-line text-text-primary">{requirement.description}</p>
        <p className="text-[13px] font-medium text-text-primary">
          Quote deadline: {formatDateTime(requirement.bidDeadline)} {closed && "(closed)"}
        </p>
      </Card>

      <ContactDetails
        vendorCompanyId={id}
        requirementId={reqId}
        revealed={!!invite.contactRevealedAt}
        address={requirement.society.address}
        registrantName={requirement.society.registrantName}
        registrantPhone={requirement.society.registrantPhone}
        registrantEmail={requirement.society.registrantEmail}
      />

      {closed ? (
        myBid ? (
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-text-primary">
                Your quote: ₹{Number(myBid.totalAmount).toFixed(2)}
              </p>
              <Badge tone={statusTone(myBid.status)}>{statusLabel(myBid.status)}</Badge>
            </div>

            <div className="overflow-x-auto border-t border-border-subtle pt-3">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border-subtle text-text-tertiary">
                    <th className="pb-2 pr-2 text-[11px] font-semibold uppercase tracking-wide">Description</th>
                    <th className="pb-2 pr-2 text-right text-[11px] font-semibold uppercase tracking-wide">Qty</th>
                    <th className="pb-2 pr-2 text-[11px] font-semibold uppercase tracking-wide">Unit</th>
                    <th className="pb-2 pr-2 text-right text-[11px] font-semibold uppercase tracking-wide">
                      Rate (₹)
                    </th>
                    <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-wide">
                      Amount (₹)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {myBid.lineItems.map((li) => (
                    <tr key={li.id} className="border-b border-border-subtle last:border-0">
                      <td className="py-2 pr-2 text-text-primary">{li.description}</td>
                      <td className="py-2 pr-2 text-right whitespace-nowrap text-text-secondary">
                        {li.quantity.toString()}
                      </td>
                      <td className="py-2 pr-2 whitespace-nowrap text-text-secondary">{li.unit}</td>
                      <td className="py-2 pr-2 text-right whitespace-nowrap text-text-secondary">
                        {Number(li.unitRate).toFixed(2)}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap font-medium text-text-primary">
                        {Number(li.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border-subtle pt-3 sm:grid-cols-4">
              <QuoteDetail label="Quote validity" value={formatDate(myBid.bidValidity)} />
              {myBid.paymentTerms && <QuoteDetail label="Payment terms" value={myBid.paymentTerms} />}
              {myBid.warrantyPeriod && <QuoteDetail label="Warranty" value={myBid.warrantyPeriod} />}
              {myBid.completionTime && <QuoteDetail label="Time to complete" value={myBid.completionTime} />}
            </div>

            {myBid.notes && (
              <div className="border-t border-border-subtle pt-3">
                <QuoteDetail label="Notes" value={myBid.notes} />
              </div>
            )}

            {myBid.workOrder && (
              <a
                href={`/api/work-orders/${myBid.workOrder.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[13px] text-accent-primary underline"
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
                  paymentTerms: myBid.paymentTerms ?? "",
                  warrantyPeriod: myBid.warrantyPeriod ?? "",
                  completionTime: myBid.completionTime ?? "",
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
                  paymentTerms: myDraft.paymentTerms,
                  warrantyPeriod: myDraft.warrantyPeriod,
                  completionTime: myDraft.completionTime,
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

function QuoteDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] text-text-secondary">{label}</p>
      <p className="text-[15px] text-text-primary">{value}</p>
    </div>
  );
}
