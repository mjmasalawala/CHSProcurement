import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyAssignment } from "@/lib/society-auth";
import { MIN_ACTIVE_OFFICE_BEARERS, countActiveOfficeBearers } from "@/lib/society-ob";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-badge";
import { ThresholdCard, DecideThresholdPanel } from "./panel";

export const dynamic = "force-dynamic";

export default async function SocietySettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assignment = await requireSocietyAssignment(id, `/society/${id}/settings`);
  const session = await auth();

  const [society, pendingChange, history, obCount] = await Promise.all([
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
    countActiveOfficeBearers(id),
  ]);

  const canPropose =
    assignment.permissions.includes(PERMISSIONS.PROPOSE_THRESHOLD_CHANGE) &&
    obCount >= MIN_ACTIVE_OFFICE_BEARERS;
  const canDecide =
    !!pendingChange &&
    assignment.permissions.includes(PERMISSIONS.APPROVE_REJECT_QUOTATION) &&
    pendingChange.proposedByUserId !== session?.user.id;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Settings</h1>

      {obCount < MIN_ACTIVE_OFFICE_BEARERS && (
        <Card className="border-status-warning-border bg-status-warning-bg">
          <p className="text-[13px] text-text-secondary">
            This society has {obCount} active Office Bearer{obCount === 1 ? "" : "s"} (Chairman/Secretary/
            Treasurer). Threshold changes can&apos;t be proposed until at least {MIN_ACTIVE_OFFICE_BEARERS}{" "}
            are active — visit{" "}
            <a href={`/society/${id}/members`} className="font-semibold text-accent-primary underline">
              Members
            </a>{" "}
            to invite more.
          </p>
        </Card>
      )}

      <ThresholdCard
        societyId={id}
        currentValue={String(society.approvalThreshold)}
        canPropose={canPropose && !pendingChange}
      />

      {pendingChange && (
        <Card className="flex flex-col gap-2 border-status-warning-border bg-status-warning-bg">
          <p className="text-[15px] font-semibold text-text-primary">Pending threshold change</p>
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

      {history.length > 0 && (
        <div>
          <h2 className="mb-2 text-[18px] font-semibold text-text-primary">Threshold change history</h2>
          <div className="flex flex-col gap-2">
            {history.map((change) => (
              <div
                key={change.id}
                className="flex items-center justify-between rounded-lg border border-border-subtle bg-background-primary p-3 shadow-xs"
              >
                <div>
                  <p className="text-[13px] font-medium text-text-primary">
                    ₹{change.oldValue} → ₹{change.newValue}
                  </p>
                  <p className="text-[13px] text-text-secondary">
                    Proposed by {change.proposedByUser.name ?? change.proposedByUser.email}
                    {change.approvedByUser &&
                      ` · decided by ${change.approvedByUser.name ?? change.approvedByUser.email}`}{" "}
                    on {change.decidedAt?.toLocaleDateString()}
                  </p>
                </div>
                <Badge tone={statusTone(change.status)}>{statusLabel(change.status)}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
