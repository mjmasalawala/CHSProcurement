import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyAssignment } from "@/lib/society-auth";
import { OB_ROLES } from "@/lib/society-ob";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-badge";
import { formatDate, formatDateTime, formatDuration } from "@/lib/date";
import { BidComparison } from "./bid-comparison";
import { ApprovalPanel } from "./approval-panel";
import { EditableProjectName } from "./editable-name";
import { ExtendDeadlineButton } from "./extend-deadline";

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
  // Any of the 4 society roles can view (society-portal-spec.md Section 11
  // — Archive/detail view is base role, any assignment). Recommend/vote
  // actions are separately gated by RECOMMEND_BID / APPROVE_REJECT_QUOTATION
  // at the action layer.
  const assignment = await requireSocietyAssignment(id, `/society/${id}/requirements/${reqId}`);
  const session = await auth();

  const requirement = await prisma.requirement.findUnique({
    where: { id: reqId },
    include: {
      categories: true,
      invites: { include: { vendorCompany: { select: { name: true } } } },
      bids: {
        include: { vendorCompany: { select: { name: true } }, lineItems: true },
        orderBy: { totalAmount: "asc" },
      },
      quotationApprovals: true,
      workOrder: true,
    },
  });

  if (!requirement || requirement.societyId !== id) notFound();

  const closed = isClosed(requirement.bidDeadline);
  const canRecommend = assignment.permissions.includes(PERMISSIONS.RECOMMEND_BID);
  const canVote = assignment.permissions.includes(PERMISSIONS.APPROVE_REJECT_QUOTATION);
  const canEditName = assignment.permissions.includes(PERMISSIONS.CREATE_REQUIREMENT);
  const bidByVendorId = new Map(requirement.bids.map((b) => [b.vendorCompanyId, b.createdAt]));

  const obAssignments =
    requirement.status === "AWAITING_APPROVAL"
      ? await prisma.roleAssignment.findMany({
          where: { entityType: "SOCIETY", entityId: id, role: { in: [...OB_ROLES] }, status: "ACTIVE" },
          include: { user: true },
        })
      : [];

  const votes = obAssignments.map((ra) => {
    const vote = requirement.quotationApprovals.find((qa) => qa.officeBearerUserId === ra.userId);
    return { role: ra.role, name: ra.user.name ?? ra.user.email, decision: vote?.decision ?? null };
  });
  const hasVoted = requirement.quotationApprovals.some((qa) => qa.officeBearerUserId === session?.user.id);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/society/${id}/requirements`}
        className="text-[13px] text-text-secondary underline hover:text-text-primary"
      >
        ← Back to Requirements
      </Link>

      <div>
        <div className="flex items-center gap-3">
          <EditableProjectName
            societyId={id}
            requirementId={reqId}
            initialName={requirement.name}
            canEdit={canEditName}
          />
          <Badge tone={statusTone(requirement.status)}>{statusLabel(requirement.status)}</Badge>
        </div>
        <p className="text-[13px] text-text-secondary">{requirement.categories.map((c) => c.name).join(", ")}</p>
        <p className="text-[13px] text-text-tertiary">
          ID: {requirement.id} · Raised {formatDate(requirement.createdAt)}
        </p>
      </div>

      <Card className="flex flex-col gap-2">
        <p className="text-[15px] text-text-primary">{requirement.description}</p>
        <p className="text-[13px] font-medium text-text-primary">
          Quote deadline: {formatDateTime(requirement.bidDeadline)} {closed && "(closed)"}
        </p>
        <details className="group text-[13px] text-text-secondary">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
            <span>
              {requirement.invites.length} vendor{requirement.invites.length === 1 ? "" : "s"} matched and invited
            </span>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="h-3.5 w-3.5 shrink-0 text-text-tertiary transition-transform group-open:rotate-180"
            >
              <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          {requirement.invites.length === 0 ? (
            <p className="mt-2 text-text-tertiary">No vendors matched yet.</p>
          ) : (
            <table className="mt-2 w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] uppercase tracking-wide text-text-tertiary">
                  <th className="py-1.5 pr-3 font-semibold">Vendor</th>
                  <th className="py-1.5 pr-3 font-semibold">Matched</th>
                  <th className="py-1.5 pr-3 font-semibold">Time given</th>
                  <th className="py-1.5 font-semibold">Quoted</th>
                </tr>
              </thead>
              <tbody>
                {requirement.invites.map((inv) => {
                  const windowEnd = closed ? requirement.bidDeadline : new Date();
                  const givenMs = Math.max(0, windowEnd.getTime() - inv.createdAt.getTime());
                  const bidAt = bidByVendorId.get(inv.vendorCompanyId);
                  return (
                    <tr key={inv.id} className="border-b border-border-subtle last:border-0">
                      <td className="py-1.5 pr-3 font-medium text-text-primary">{inv.vendorCompany.name}</td>
                      <td className="whitespace-nowrap py-1.5 pr-3">{formatDate(inv.createdAt)}</td>
                      <td className="whitespace-nowrap py-1.5 pr-3">{formatDuration(givenMs)}</td>
                      <td className="whitespace-nowrap py-1.5">{bidAt ? formatDate(bidAt) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </details>
      </Card>

      {requirement.status === "RETURNED_TO_MANAGER" && (
        <Card className="border-status-warning-border bg-status-warning-bg">
          <p className="text-[15px] font-semibold text-text-primary">Sent back to you</p>
          <p className="mt-1 text-[13px] text-text-secondary">
            2 of 3 Office Bearers rejected the previous recommendation. Pick a quote to recommend again below.
          </p>
        </Card>
      )}

      {requirement.status === "FINALIZED" && requirement.workOrder && (
        <Card className="flex flex-col gap-2 border-status-success-border bg-status-success-bg">
          <p className="text-[15px] font-semibold text-text-primary">
            Finalized — Work Order {requirement.workOrder.workOrderNumber}
          </p>
          <p className="text-[13px] text-text-secondary">{requirement.workOrder.approvalSummary}</p>
          {requirement.workOrder.justificationNote && (
            <p className="text-[13px] text-text-secondary">
              Justification: {requirement.workOrder.justificationNote}
            </p>
          )}
          <p className="text-[13px] text-text-secondary">
            Awarded to {requirement.workOrder.vendorNameSnapshot}
          </p>
          <a
            href={`/api/work-orders/${requirement.workOrder.id}/pdf`}
            className="mt-1 inline-block text-[13px] font-semibold text-accent-primary underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download Work Order PDF
          </a>
        </Card>
      )}

      {requirement.status === "AWAITING_APPROVAL" && (
        <ApprovalPanel
          societyId={id}
          requirementId={reqId}
          votes={votes}
          canVote={canVote && !hasVoted}
        />
      )}

      {!closed ? (
        <p className="text-[13px] text-text-secondary">
          Quotes stay blind until the deadline — check back once it closes to compare.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {requirement.bids.length === 0 && (
            <p className="text-[13px] text-text-secondary">No quotes were submitted for this requirement.</p>
          )}

          {requirement.bids.length > 0 && requirement.status !== "FINALIZED" && (
            <BidComparison
              societyId={id}
              requirementId={reqId}
              canRecommend={canRecommend}
              bids={requirement.bids.map((b) => ({
                id: b.id,
                vendorName: b.vendorCompany.name,
                totalAmount: b.totalAmount.toString(),
                bidValidity: formatDate(b.bidValidity),
                paymentTerms: b.paymentTerms,
                warrantyPeriod: b.warrantyPeriod,
                completionTime: b.completionTime,
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

          {canEditName && requirement.status === "OPEN" && requirement.bids.length < 3 && (
            <ExtendDeadlineButton societyId={id} requirementId={reqId} />
          )}
        </div>
      )}
    </div>
  );
}
