import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyAssignment } from "@/lib/society-auth";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SocietyDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assignment = await requireSocietyAssignment(id, `/society/${id}`);
  const session = await auth();

  const canCreateRequirement = assignment.permissions.includes(PERMISSIONS.CREATE_REQUIREMENT);
  const canRecommendBid = assignment.permissions.includes(PERMISSIONS.RECOMMEND_BID);
  const isOfficeBearer = assignment.permissions.includes(PERMISSIONS.APPROVE_REJECT_QUOTATION);

  const [openRequirements, awaitingReview, pendingVotes, pendingThreshold, pendingRemovals] = await Promise.all([
    canCreateRequirement
      ? prisma.requirement.count({ where: { societyId: id, bidDeadline: { gt: new Date() } } })
      : Promise.resolve(null),
    canRecommendBid
      ? prisma.requirement.count({
          where: { societyId: id, bidDeadline: { lte: new Date() }, recommendedBidId: null },
        })
      : Promise.resolve(null),
    isOfficeBearer && session
      ? prisma.requirement.findMany({
          where: {
            societyId: id,
            status: "AWAITING_APPROVAL",
            recommendedBidId: { not: null },
            quotationApprovals: { none: { officeBearerUserId: session.user.id } },
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    isOfficeBearer && session
      ? prisma.proposedChange.findFirst({
          where: {
            societyId: id,
            field: "approvalThreshold",
            status: "PENDING",
            proposedByUserId: { not: session.user.id },
          },
        })
      : Promise.resolve(null),
    isOfficeBearer && session
      ? prisma.proposedChange.findMany({
          where: {
            societyId: id,
            field: "remove_member",
            status: "PENDING",
            proposedByUserId: { not: session.user.id },
          },
        })
      : Promise.resolve([]),
  ]);

  const hasPendingTasks = pendingVotes.length > 0 || !!pendingThreshold || pendingRemovals.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Dashboard</h1>

      {hasPendingTasks && (
        <div className="flex flex-col gap-2">
          <h2 className="text-[15px] font-semibold text-text-primary">Needs your approval</h2>
          {pendingThreshold && (
            <Link href={`/society/${id}/settings`}>
              <Card className="border-status-warning-border bg-status-warning-bg">
                <p className="text-[13px] text-text-secondary">
                  Threshold change proposed: ₹{pendingThreshold.oldValue} → ₹{pendingThreshold.newValue}
                </p>
              </Card>
            </Link>
          )}
          {pendingRemovals.map((pc) => (
            <Link key={pc.id} href={`/society/${id}/members`}>
              <Card className="border-status-warning-border bg-status-warning-bg">
                <p className="text-[13px] text-text-secondary">Member removal proposed — {pc.newValue}</p>
              </Card>
            </Link>
          ))}
          {pendingVotes.map((r) => (
            <Link key={r.id} href={`/society/${id}/requirements/${r.id}`}>
              <Card className="border-status-warning-border bg-status-warning-bg">
                <p className="text-[13px] text-text-secondary">Quotation approval needed — {r.name}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {canCreateRequirement ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link href={`/society/${id}/requirements`}>
            <Card>
              <p className="text-[13px] text-text-secondary">Open requirements</p>
              <p className="text-[28px] font-bold tracking-tight text-text-primary">{openRequirements}</p>
            </Card>
          </Link>
          {canRecommendBid && (
            <Link href={`/society/${id}/requirements`}>
              <Card>
                <p className="text-[13px] text-text-secondary">Closed, awaiting your review</p>
                <p className="text-[28px] font-bold tracking-tight text-text-primary">{awaitingReview}</p>
              </Card>
            </Link>
          )}
        </div>
      ) : (
        !hasPendingTasks && (
          <Card>
            <p className="text-[15px] text-text-primary">Nothing needs your attention yet.</p>
          </Card>
        )
      )}
    </div>
  );
}
