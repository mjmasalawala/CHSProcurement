import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyAssignment } from "@/lib/society-auth";
import { Card } from "@/components/ui/card";
import { ProposeThresholdForm, DecideThresholdPanel } from "./panel";

export const dynamic = "force-dynamic";

export default async function SocietySettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assignment = await requireSocietyAssignment(id, `/society/${id}/settings`);
  const session = await auth();

  const [society, pendingChange, history] = await Promise.all([
    prisma.society.findUniqueOrThrow({ where: { id } }),
    prisma.proposedChange.findFirst({
      where: { societyId: id, field: "approvalThreshold", status: "PENDING" },
      include: { proposedByUser: true },
    }),
    prisma.proposedChange.findMany({
      where: { societyId: id, field: "approvalThreshold", status: { not: "PENDING" } },
      include: { proposedByUser: true, approvedByUser: true },
      orderBy: { decidedAt: "desc" },
      take: 10,
    }),
  ]);

  const canPropose = assignment.permissions.includes(PERMISSIONS.PROPOSE_THRESHOLD_CHANGE);
  const canDecide =
    !!pendingChange &&
    assignment.permissions.includes(PERMISSIONS.APPROVE_REJECT_QUOTATION) &&
    pendingChange.proposedByUserId !== session?.user.id;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[24px] font-bold text-text-primary">Settings</h1>

      <Card className="flex flex-col gap-2">
        <p className="text-[13px] text-text-secondary">Approval threshold</p>
        <p className="text-[24px] font-bold text-text-primary">₹{society.approvalThreshold}</p>
        <p className="text-[13px] text-text-secondary">
          Recommendations below this amount auto-finalize; at or above, 2 of 3 Office Bearers must approve.
        </p>
      </Card>

      {pendingChange && (
        <Card className="flex flex-col gap-2 border-status-warning">
          <p className="text-[15px] font-medium text-text-primary">Pending threshold change</p>
          <p className="text-[13px] text-text-secondary">
            {pendingChange.proposedByUser.name ?? pendingChange.proposedByUser.email} proposed ₹
            {pendingChange.oldValue} → ₹{pendingChange.newValue}
          </p>
          {canDecide && <DecideThresholdPanel societyId={id} proposedChangeId={pendingChange.id} />}
          {!canDecide && !canPropose && (
            <p className="text-[13px] text-text-secondary">Awaiting another Office Bearer&apos;s decision.</p>
          )}
        </Card>
      )}

      {canPropose && !pendingChange && (
        <Card>
          <ProposeThresholdForm societyId={id} />
        </Card>
      )}

      {history.length > 0 && (
        <div>
          <h2 className="mb-2 text-[18px] font-semibold text-text-primary">Threshold change history</h2>
          <div className="flex flex-col gap-2">
            {history.map((change) => (
              <div key={change.id} className="rounded-lg border border-border-subtle p-3">
                <p className="text-[13px] text-text-primary">
                  ₹{change.oldValue} → ₹{change.newValue} — {change.status}
                </p>
                <p className="text-[13px] text-text-secondary">
                  Proposed by {change.proposedByUser.name ?? change.proposedByUser.email}
                  {change.approvedByUser &&
                    ` · decided by ${change.approvedByUser.name ?? change.approvedByUser.email}`}{" "}
                  on {change.decidedAt?.toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
