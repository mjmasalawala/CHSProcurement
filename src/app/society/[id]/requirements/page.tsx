import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyPagePermission } from "@/lib/society-auth";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { formatDateTime } from "@/lib/date";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

function statusFor(status: string, deadline: Date): { label: string; tone: BadgeTone } {
  switch (status) {
    case "AWAITING_APPROVAL":
      return { label: "Awaiting Office Bearer approval", tone: "warning" };
    case "RETURNED_TO_MANAGER":
      return { label: "Returned to you", tone: "warning" };
    case "FINALIZED":
      return { label: "Finalized", tone: "success" };
    default:
      return deadline.getTime() > Date.now()
        ? { label: "Open", tone: "info" }
        : { label: "Awaiting review", tone: "neutral" };
  }
}

export default async function SocietyRequirementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  await requireSocietyPagePermission(id, PERMISSIONS.CREATE_REQUIREMENT, `/society/${id}/requirements`);

  const { q } = await searchParams;

  const where: Prisma.RequirementWhereInput = { societyId: id };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { categories: { some: { name: { contains: q, mode: "insensitive" } } } },
      { bids: { some: { vendorCompany: { name: { contains: q, mode: "insensitive" } } } } },
    ];
  }

  const requirements = await prisma.requirement.findMany({
    where,
    include: {
      categories: true,
      _count: { select: { invites: true, bids: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Requirements</h1>
        <Link href={`/society/${id}/requirements/new`}>
          <Button>New requirement</Button>
        </Link>
      </div>

      <SearchInput placeholder="Search by name, description, category, or vendor…" />

      {requirements.length === 0 ? (
        <p className="text-[13px] text-text-secondary">
          {q ? "No requirements match your search." : "No requirements raised yet."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {requirements.map((req) => {
            const status = statusFor(req.status, req.bidDeadline);
            return (
              <Link
                key={req.id}
                href={`/society/${id}/requirements/${req.id}`}
                className="flex items-center justify-between rounded-xl border border-border-subtle bg-background-primary p-4 shadow-xs transition-shadow hover:shadow-sm"
              >
                <div>
                  <p className="text-[15px] font-semibold text-text-primary">{req.name}</p>
                  <p className="text-[13px] text-text-secondary">
                    {req.categories.map((c) => c.name).join(", ")} · {req.description.slice(0, 80)}
                  </p>
                  <p className="text-[13px] text-text-tertiary">
                    {req._count.invites} vendors invited · {req._count.bids} quotes · deadline{" "}
                    {formatDateTime(req.bidDeadline)}
                  </p>
                </div>
                <Badge tone={status.tone}>{status.label}</Badge>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
