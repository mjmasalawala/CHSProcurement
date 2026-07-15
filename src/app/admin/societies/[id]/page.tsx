import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePagePermission } from "@/lib/admin-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-badge";
import { ApproveRejectPanel } from "./panel";

export const dynamic = "force-dynamic";

const OFFICE_BEARER_ROLES = ["CHAIRMAN", "SECRETARY", "TREASURER"] as const;

const ROLE_LABELS: Record<string, string> = {
  MANAGER: "Manager",
  CHAIRMAN: "Chairman",
  SECRETARY: "Secretary",
  TREASURER: "Treasurer",
};

export default async function AdminSocietyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission(PERMISSIONS.SOCIETY_QUEUE_ACCESS, `/admin/societies/${id}`);

  const [society, members] = await Promise.all([
    prisma.society.findUnique({
      where: { id },
      include: { city: true },
    }),
    prisma.roleAssignment.findMany({
      where: { entityType: "SOCIETY", entityId: id, role: { in: ["MANAGER", ...OFFICE_BEARER_ROLES] } },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!society) notFound();

  // Manager first, then Office Bearers in a fixed order — not registration order.
  const roleOrder = ["MANAGER", ...OFFICE_BEARER_ROLES];
  const orderedMembers = [...members].sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <Link href="/admin/societies" className="text-[13px] text-text-secondary underline hover:text-text-primary">
        ← Back to Societies
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary">{society.name}</h1>
        <Badge tone={statusTone(society.status)} className="w-fit">
          {statusLabel(society.status)}
        </Badge>
      </div>

      <Card className="flex flex-col gap-3">
        <Row label="City" value={society.city.name} />
        <Row label="Address" value={society.address} />
        <Row label="Units" value={String(society.unitsCount)} />
        <Row label="Registration Number" value={society.registrationNumber ?? "—"} />
        <Row
          label="Secretary"
          value={`${society.secretaryName} · ${society.secretaryEmail} · ${society.secretaryPhone}`}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold text-text-primary">Members</h2>

        {orderedMembers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border-subtle text-text-tertiary">
                  <th className="pb-2 pr-2 font-semibold uppercase tracking-wide text-[11px]">Role</th>
                  <th className="pb-2 pr-2 font-semibold uppercase tracking-wide text-[11px]">Name</th>
                  <th className="pb-2 pr-2 font-semibold uppercase tracking-wide text-[11px]">Email</th>
                  <th className="pb-2 font-semibold uppercase tracking-wide text-[11px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {orderedMembers.map((member) => (
                  <tr key={member.id} className="border-b border-border-subtle last:border-0">
                    <td className="py-2 pr-2 whitespace-nowrap text-text-secondary">
                      {ROLE_LABELS[member.role] ?? member.role}
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap font-medium text-text-primary">
                      {member.user.name ?? "—"}
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap text-text-secondary">{member.user.email}</td>
                    <td className="py-2">
                      <Badge tone={statusTone(member.status)}>{statusLabel(member.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px] text-text-secondary">No Manager or Office Bearers appointed yet.</p>
        )}
      </Card>

      <ApproveRejectPanel societyId={society.id} status={society.status} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] text-text-secondary">{label}</p>
      <p className="text-[15px] text-text-primary">{value}</p>
    </div>
  );
}
