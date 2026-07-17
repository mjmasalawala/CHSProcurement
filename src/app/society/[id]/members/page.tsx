import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyPageAnyPermission } from "@/lib/society-auth";
import { MIN_ACTIVE_OFFICE_BEARERS, countActiveOfficeBearers } from "@/lib/society-ob";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-badge";
import {
  InviteMemberForm,
  ToggleMemberButton,
  ResendInviteButton,
  ProposeRemovalButton,
  DecideRemovalPanel,
} from "./controls";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  MANAGER: "Manager",
  CHAIRMAN: "Chairman",
  SECRETARY: "Secretary",
  TREASURER: "Treasurer",
};

export default async function SocietyMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Reachable by whoever holds any one of these — MANAGE_USERS (Secretary,
  // for the invite form and Deactivate/Reactivate) or either member-removal
  // permission (any Office Bearer, for propose/decide). Each is checked
  // independently below for the specific actions it unlocks.
  const assignment = await requireSocietyPageAnyPermission(
    id,
    [PERMISSIONS.MANAGE_USERS, PERMISSIONS.PROPOSE_MEMBER_REMOVAL, PERMISSIONS.APPROVE_MEMBER_REMOVAL],
    `/society/${id}/members`,
  );
  const session = await auth();

  const [members, obCount, pendingRemovals] = await Promise.all([
    prisma.roleAssignment.findMany({
      where: { entityType: "SOCIETY", entityId: id, role: { in: ["MANAGER", "CHAIRMAN", "SECRETARY", "TREASURER"] } },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    countActiveOfficeBearers(id),
    prisma.proposedChange.findMany({
      where: { societyId: id, field: "remove_member", status: "PENDING" },
      include: { proposedByUser: true },
    }),
  ]);

  // Chairman/Secretary/Treasurer are single-seat — the invite form disables
  // re-inviting a post that already has an active holder (server-enforced
  // too, see members/actions.ts).
  const occupiedRoles = members
    .filter((m) => m.status === "ACTIVE" && (m.role === "CHAIRMAN" || m.role === "SECRETARY" || m.role === "TREASURER"))
    .map((m) => m.role);

  const canManageUsers = assignment.permissions.includes(PERMISSIONS.MANAGE_USERS);
  const canProposeRemoval = assignment.permissions.includes(PERMISSIONS.PROPOSE_MEMBER_REMOVAL);
  const canDecideRemoval = assignment.permissions.includes(PERMISSIONS.APPROVE_MEMBER_REMOVAL);
  const pendingRemovalByTarget = new Map(pendingRemovals.map((pc) => [pc.oldValue, pc]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Members</h1>

      {obCount < MIN_ACTIVE_OFFICE_BEARERS && (
        <Card className="border-status-warning-border bg-status-warning-bg">
          <p className="text-[13px] text-text-secondary">
            This society has {obCount} active Office Bearer{obCount === 1 ? "" : "s"} (Chairman/Secretary/
            Treasurer). Requirements can&apos;t be raised and threshold changes can&apos;t be proposed until
            at least {MIN_ACTIVE_OFFICE_BEARERS} are active — quotation approval needs 2 signoffs.
          </p>
        </Card>
      )}

      {canManageUsers && (
        <Card>
          <p className="mb-3 text-[13px] text-text-secondary">
            Invite the Manager, Chairman, Secretary, or Treasurer.
          </p>
          <InviteMemberForm societyId={id} occupiedRoles={occupiedRoles} />
        </Card>
      )}

      {pendingRemovals.map((pc) => {
        const canDecideThis = canDecideRemoval && session?.user.id !== pc.proposedByUserId;
        return (
          <Card key={pc.id} className="flex flex-col gap-2 border-status-warning-border bg-status-warning-bg">
            <p className="text-[15px] font-semibold text-text-primary">Pending removal: {pc.newValue}</p>
            <p className="text-[13px] text-text-secondary">
              Proposed by {pc.proposedByUser.name ?? pc.proposedByUser.email}
            </p>
            {canDecideThis && <DecideRemovalPanel societyId={id} proposedChangeId={pc.id} />}
            {!canDecideThis && (
              <p className="text-[13px] text-text-secondary">Awaiting another Office Bearer&apos;s decision.</p>
            )}
          </Card>
        );
      })}

      <div className="flex flex-col gap-2">
        {members.length === 0 && <p className="text-[13px] text-text-secondary">No members yet.</p>}
        {members.map((ra) => (
          <div
            key={ra.id}
            className="flex items-center justify-between rounded-xl border border-border-subtle bg-background-primary p-4 shadow-xs"
          >
            <div>
              <p className="text-[15px] font-semibold text-text-primary">{ra.user.name ?? ra.user.email}</p>
              <p className="text-[13px] text-text-secondary">
                {ra.user.email} · {ROLE_LABELS[ra.role] ?? ra.role}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {ra.status === "PENDING" && (
                <p className="text-[13px] text-text-secondary">Invited — waiting for them to set a password</p>
              )}
              <Badge tone={statusTone(ra.status)}>{statusLabel(ra.status)}</Badge>
              {canManageUsers && ra.status === "PENDING" && (
                <ResendInviteButton societyId={id} roleAssignmentId={ra.id} />
              )}
              {canManageUsers && ra.status !== "PENDING" && (
                <ToggleMemberButton societyId={id} roleAssignmentId={ra.id} active={ra.status === "ACTIVE"} />
              )}
              {canProposeRemoval && ra.status === "ACTIVE" && !pendingRemovalByTarget.has(ra.id) && (
                <ProposeRemovalButton societyId={id} roleAssignmentId={ra.id} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
