import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePagePermission } from "@/lib/admin-auth";
import type { EntityStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-badge";

export const dynamic = "force-dynamic";

const TABS: { value: EntityStatus | "ALL"; label: string }[] = [
  { value: "PENDING_VERIFICATION", label: "Pending" },
  { value: "ACTIVE", label: "Active" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function AdminSocietiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requirePagePermission(PERMISSIONS.SOCIETY_QUEUE_ACCESS, "/admin/societies");

  const { status } = await searchParams;
  const activeTab = TABS.some((t) => t.value === status) ? (status as EntityStatus | "ALL") : "PENDING_VERIFICATION";

  const societies = await prisma.society.findMany({
    where: activeTab === "ALL" ? {} : { status: activeTab },
    include: { city: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Societies</h1>

      <div className="flex gap-1 border-b border-border-subtle pb-3">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/societies?status=${tab.value}`}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              activeTab === tab.value
                ? "bg-accent-primary text-white shadow-xs"
                : "text-text-secondary hover:bg-background-tertiary"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {societies.length === 0 ? (
        <p className="text-[13px] text-text-secondary">No societies here.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {societies.map((society) => (
            <Link
              key={society.id}
              href={`/admin/societies/${society.id}`}
              className="flex items-center justify-between rounded-xl border border-border-subtle bg-background-primary p-4 shadow-xs transition-shadow hover:shadow-sm"
            >
              <div>
                <p className="text-[15px] font-semibold text-text-primary">{society.name}</p>
                <p className="text-[13px] text-text-secondary">
                  {society.city.name} · {society.unitsCount} units
                </p>
                <p className="text-[13px] text-text-tertiary">
                  Secretary: {society.secretaryName} · {society.secretaryEmail}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge tone={statusTone(society.status)}>{statusLabel(society.status)}</Badge>
                {society.status === "PENDING_VERIFICATION" && (
                  <p className="text-[13px] font-medium text-status-warning">
                    {daysSince(society.createdAt)}d pending
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
