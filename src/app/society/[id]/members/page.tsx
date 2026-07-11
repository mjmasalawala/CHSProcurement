import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyPagePermission } from "@/lib/society-auth";
import { MIN_ACTIVE_OFFICE_BEARERS, countActiveOfficeBearers } from "@/lib/society-ob";
import { Card } from "@/components/ui/card";
import { InviteMemberForm, ToggleMemberButton } from "./controls";

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
  await requireSocietyPagePermission(id, PERMISSIONS.MANAGE_USERS, `/society/${id}/members`);

  const [members, obCount] = await Promise.all([
    prisma.roleAssignment.findMany({
      where: { entityType: "SOCIETY", entityId: id, role: { in: ["MANAGER", "CHAIRMAN", "SECRETARY", "TREASURER"] } },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    countActiveOfficeBearers(id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[24px] font-bold text-text-primary">Members</h1>

      {obCount < MIN_ACTIVE_OFFICE_BEARERS && (
        <Card className="border-status-warning">
          <p className="text-[13px] text-text-secondary">
            This society has {obCount} active Office Bearer{obCount === 1 ? "" : "s"} (Chairman/Secretary/
            Treasurer). Requirements can&apos;t be raised and threshold changes can&apos;t be proposed until
            at least {MIN_ACTIVE_OFFICE_BEARERS} are active — quotation approval needs 2 signoffs.
          </p>
        </Card>
      )}

      <Card>
        <p className="mb-3 text-[13px] text-text-secondary">
          Invite the Manager, Chairman, or Treasurer. The Secretary role is assigned once by ProSoc during
          registration approval.
        </p>
        <InviteMemberForm societyId={id} />
      </Card>

      <div className="flex flex-col gap-2">
        {members.length === 0 && <p className="text-[13px] text-text-secondary">No members yet.</p>}
        {members.map((ra) => (
          <div
            key={ra.id}
            className="flex items-center justify-between rounded-lg border border-border-subtle p-4"
          >
            <div>
              <p className="text-[15px] font-medium text-text-primary">{ra.user.name ?? ra.user.email}</p>
              <p className="text-[13px] text-text-secondary">
                {ra.user.email} · {ROLE_LABELS[ra.role] ?? ra.role} · {ra.status}
              </p>
            </div>
            {ra.role !== "SECRETARY" && ra.status !== "PENDING" && (
              <ToggleMemberButton societyId={id} roleAssignmentId={ra.id} active={ra.status === "ACTIVE"} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
