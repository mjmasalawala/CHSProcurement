import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyAssignment } from "@/lib/society-auth";
import { OB_ROLES } from "@/lib/society-ob";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-badge";
import { BidComparison } from "./bid-comparison";
import { ApprovalPanel } from "./approval-panel";

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

  const requirement = await prisma.requirement.findUnique({
    where: { id: reqId },
    include: {
      category: true,
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary">{requirement.category.name}</h1>
        <Badge tone={statusTone(requirement.status)}>{statusLabel(requirement.status)}</Badge>
      </div>

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

      {requirement.status === "RETURNED_TO_MANAGER" && (
        <Card className="border-status-warning-border bg-status-warning-bg">
          <p className="text-[15px] font-semibold text-text-primary">Sent back to you</p>
          <p className="mt-1 text-[13px] text-text-secondary">
            2 of 3 Office Bearers rejected the previous recommendation. Pick a bid to recommend again below.
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
        <ApprovalPanel societyId={id} requirementId={reqId} votes={votes} canVote={canVote} />
      )}

      {!closed ? (
        <p className="text-[13px] text-text-secondary">
          Bids stay blind until the deadline — check back once it closes to compare.
        </p>
      ) : requirement.bids.length === 0 ? (
        <p className="text-[13px] text-text-secondary">No bids were submitted for this requirement.</p>
      ) : requirement.status === "FINALIZED" ? null : (
        <BidComparison
          societyId={id}
          requirementId={reqId}
          canRecommend={canRecommend}
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
