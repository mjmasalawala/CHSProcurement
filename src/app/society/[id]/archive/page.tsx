import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyPagePermission } from "@/lib/society-auth";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-badge";
import { formatDate } from "@/lib/date";
import type { RequirementStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: { value: RequirementStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "AWAITING_APPROVAL", label: "Awaiting approval" },
  { value: "RETURNED_TO_MANAGER", label: "Returned to Manager" },
  { value: "FINALIZED", label: "Finalized" },
];

interface SearchParams {
  q?: string;
  category?: string;
  status?: string;
  vendor?: string;
  from?: string;
  to?: string;
}

export default async function SocietyArchivePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  await requireSocietyPagePermission(id, PERMISSIONS.VIEW_ARCHIVE, `/society/${id}/archive`);

  const { q, category, status, vendor, from, to } = await searchParams;

  const where: Prisma.RequirementWhereInput = { societyId: id };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { categories: { some: { name: { contains: q, mode: "insensitive" } } } },
      { bids: { some: { vendorCompany: { name: { contains: q, mode: "insensitive" } } } } },
    ];
  }
  if (category) where.categories = { some: { id: category } };
  if (status) where.status = status as RequirementStatus;
  if (vendor) where.bids = { some: { vendorCompany: { name: { contains: vendor, mode: "insensitive" } } } };
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const [requirements, categories, thresholdHistory] = await Promise.all([
    prisma.requirement.findMany({
      where,
      include: {
        categories: true,
        _count: { select: { bids: true, quotationApprovals: true } },
        workOrder: { select: { workOrderNumber: true, vendorNameSnapshot: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.proposedChange.findMany({
      where: { societyId: id, field: "approvalThreshold", status: { not: "PENDING" } },
      include: { proposedByUser: true, approvedByUser: true },
      orderBy: { decidedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Archive</h1>
      <p className="text-[13px] text-text-secondary">
        Every requirement and quote ever raised for this society, plus the full approval trail — nothing is
        deleted from this view.
      </p>

      <form className="flex flex-col gap-3">
        <Input name="q" placeholder="Search by name, description, category, or vendor…" defaultValue={q ?? ""} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Select name="category" defaultValue={category ?? ""}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={status ?? ""}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Input name="vendor" placeholder="Vendor name" defaultValue={vendor ?? ""} />
          <DateInput name="from" defaultValue={from ?? ""} />
          <DateInput name="to" defaultValue={to ?? ""} />
          <Button type="submit" className="col-span-2 sm:col-span-5">
            Filter
          </Button>
        </div>
      </form>

      {requirements.length === 0 ? (
        <p className="text-[13px] text-text-secondary">No requirements match these filters.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {requirements.map((req) => (
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
                  {req._count.bids} quotes · {formatDate(req.createdAt)}
                  {req.workOrder && ` · ${req.workOrder.workOrderNumber} awarded to ${req.workOrder.vendorNameSnapshot}`}
                </p>
              </div>
              <Badge tone={statusTone(req.status)}>{statusLabel(req.status)}</Badge>
            </Link>
          ))}
        </div>
      )}

      {thresholdHistory.length > 0 && (
        <div>
          <h2 className="mb-2 text-[18px] font-semibold text-text-primary">Threshold change history</h2>
          <div className="flex flex-col gap-2">
            {thresholdHistory.map((change) => (
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
                    on {change.decidedAt && formatDate(change.decidedAt)}
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
