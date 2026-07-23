import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorPagePermission } from "@/lib/vendor-auth";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { formatDateTime } from "@/lib/date";
import { MISSED_INVITE_WINDOW_MS } from "@/lib/vendor-dashboard";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

function statusFor(
  deadline: Date,
  bidStatus: "SUBMITTED" | "WON" | "NOT_SELECTED" | null,
): { label: string; tone: BadgeTone } {
  const closed = deadline.getTime() <= Date.now();
  if (!bidStatus) return closed ? { label: "Not Selected", tone: "neutral" } : { label: "New", tone: "info" };
  if (bidStatus === "WON") return { label: "Selected", tone: "success" };
  if (bidStatus === "NOT_SELECTED") return { label: "Not Selected", tone: "neutral" };
  return { label: "Quote Submitted", tone: "info" };
}

export default async function VendorRequirementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { id } = await params;
  await requireVendorPagePermission(id, PERMISSIONS.VIEW_REQUIREMENTS_INBOX, `/vendor/${id}/requirements`);

  const { q, filter } = await searchParams;
  const isMissedFilter = filter === "missed";

  const where: Prisma.RequirementInviteWhereInput = { vendorCompanyId: id };
  // Drill-down from the dashboard's "Missed invites" stat — deadline
  // already passed and this vendor never submitted a quote.
  if (isMissedFilter) {
    const now = new Date();
    where.requirement = {
      bidDeadline: { lt: now, gte: new Date(now.getTime() - MISSED_INVITE_WINDOW_MS) },
      bids: { none: { vendorCompanyId: id } },
    };
  }
  if (q) {
    where.OR = [
      { requirement: { name: { contains: q, mode: "insensitive" } } },
      { requirement: { description: { contains: q, mode: "insensitive" } } },
      { requirement: { categories: { some: { name: { contains: q, mode: "insensitive" } } } } },
      // Only matches the society's real name for invites already revealed —
      // otherwise search would leak an unrevealed society's identity to a
      // vendor who guesses its name, defeating the reveal gate.
      {
        AND: [
          { contactRevealedAt: { not: null } },
          { requirement: { society: { name: { contains: q, mode: "insensitive" } } } },
        ],
      },
    ];
  }

  const invites = await prisma.requirementInvite.findMany({
    where,
    include: {
      requirement: {
        include: {
          categories: true,
          society: { select: { name: true, city: { select: { name: true } } } },
          bids: { where: { vendorCompanyId: id }, select: { status: true } },
        },
      },
    },
    orderBy: { requirement: { createdAt: "desc" } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary">
          {isMissedFilter ? "Missed Invites" : "Requirements Inbox"}
        </h1>
        {isMissedFilter && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-text-secondary">Filtered by:</span>
            <Link
              href={`/vendor/${id}/requirements`}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent-primary/30 bg-accent-primary/10 py-1 pr-2 pl-3 text-[13px] font-medium text-accent-primary transition-colors hover:bg-accent-primary/15"
              title="Clear filter"
            >
              Deadline passed, no quote (last 90 days)
              <span
                aria-hidden
                className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-primary/20 text-[12px] leading-none"
              >
                ×
              </span>
            </Link>
          </div>
        )}
      </div>

      <SearchInput placeholder="Search by name, description, category, or society…" />

      {invites.length === 0 ? (
        <p className="text-[13px] text-text-secondary">
          {isMissedFilter
            ? "No missed invites — nice work."
            : q
              ? "No requirements match your search."
              : "No requirements yet — you'll see requirements here once ProSoc's matching engine invites you to quote."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {invites.map((invite) => {
            const req = invite.requirement;
            const status = statusFor(req.bidDeadline, req.bids[0]?.status ?? null);
            const societyLabel = invite.contactRevealedAt ? req.society.name : `Society in ${req.society.city.name}`;
            return (
              <Link
                key={req.id}
                href={`/vendor/${id}/requirements/${req.id}`}
                className="flex items-center justify-between rounded-xl border border-border-subtle bg-background-primary p-4 shadow-xs transition-shadow hover:shadow-sm"
              >
                <div>
                  <p className="text-[15px] font-semibold text-text-primary">
                    {req.name} — {societyLabel}
                  </p>
                  <p className="text-[13px] text-text-secondary">
                    {req.categories.map((c) => c.name).join(", ")} · {req.description.slice(0, 80)}
                  </p>
                  <p className="text-[13px] text-text-tertiary">
                    Deadline: {formatDateTime(req.bidDeadline)}
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
