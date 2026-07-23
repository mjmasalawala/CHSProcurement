import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorAssignment } from "@/lib/vendor-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-badge";
import { formatDateTime, formatDuration } from "@/lib/date";
import { MISSED_INVITE_WINDOW_MS } from "@/lib/vendor-dashboard";

export const dynamic = "force-dynamic";

const OPEN_INVITE_LIST_LIMIT = 6;
const QUOTES_SUBMITTED_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

export default async function VendorDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assignment = await requireVendorAssignment(id, `/vendor/${id}`);

  const vendor = await prisma.vendorCompany.findUniqueOrThrow({ where: { id } });
  const now = new Date();
  const canViewInbox = assignment.permissions.includes(PERMISSIONS.VIEW_REQUIREMENTS_INBOX);
  const canViewOwnBids = assignment.permissions.includes(PERMISSIONS.VIEW_OWN_BIDS);

  // "Open" = still quotable and not yet quoted by this vendor — the count
  // and the list below it are the same underlying set (previously the
  // count included already-quoted invites and the list was a separate
  // 48h-windowed query, which read as two different numbers for what users
  // saw as one thing).
  const openInviteWhere = {
    vendorCompanyId: id,
    requirement: { bidDeadline: { gt: now }, bids: { none: { vendorCompanyId: id } } },
  };

  const [openInviteCount, openInviteList, submittedBids, totalValueWon, missedInvitesCount, bidsForResponseTime] =
    await Promise.all([
      canViewInbox ? prisma.requirementInvite.count({ where: openInviteWhere }) : null,
      canViewInbox
        ? prisma.requirementInvite.findMany({
            where: openInviteWhere,
            include: {
              requirement: {
                select: {
                  id: true,
                  name: true,
                  bidDeadline: true,
                  society: { select: { name: true, city: { select: { name: true } } } },
                },
              },
            },
            orderBy: { requirement: { bidDeadline: "asc" } },
            take: OPEN_INVITE_LIST_LIMIT,
          })
        : null,
      canViewOwnBids
        ? prisma.bid.count({
            where: {
              vendorCompanyId: id,
              createdAt: { gte: new Date(now.getTime() - QUOTES_SUBMITTED_WINDOW_MS) },
            },
          })
        : null,
      canViewOwnBids
        ? prisma.bid.aggregate({
            where: { vendorCompanyId: id, status: "WON" },
            _sum: { totalAmount: true },
          })
        : null,
      // "Missed" = deadline passed in the last 90 days with no quote ever
      // submitted — a rolling window so this doesn't just accumulate
      // forever and stop meaning anything.
      canViewInbox
        ? prisma.requirementInvite.count({
            where: {
              vendorCompanyId: id,
              requirement: {
                bidDeadline: { lt: now, gte: new Date(now.getTime() - MISSED_INVITE_WINDOW_MS) },
                bids: { none: { vendorCompanyId: id } },
              },
            },
          })
        : null,
      // Response time = gap between being matched (invite created) and
      // submitting a quote — computed here rather than stored, since it's
      // derived from two existing timestamps.
      canViewOwnBids
        ? prisma.bid.findMany({
            where: { vendorCompanyId: id },
            select: {
              createdAt: true,
              requirement: { select: { invites: { where: { vendorCompanyId: id }, select: { createdAt: true } } } },
            },
          })
        : null,
    ]);

  let avgResponseMs: number | null = null;
  if (bidsForResponseTime) {
    const diffs = bidsForResponseTime
      .map((b) => {
        const invitedAt = b.requirement.invites[0]?.createdAt;
        return invitedAt ? b.createdAt.getTime() - invitedAt.getTime() : null;
      })
      .filter((d): d is number => d !== null && d >= 0);
    if (diffs.length > 0) avgResponseMs = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Dashboard</h1>

      {vendor.status !== "ACTIVE" && (
        <Card className="border-status-warning-border bg-status-warning-bg">
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-semibold text-text-primary">Account status</p>
            <Badge tone={statusTone(vendor.status)}>{statusLabel(vendor.status)}</Badge>
          </div>
          <p className="mt-1 text-[13px] text-text-secondary">
            {vendor.status === "PENDING_VERIFICATION"
              ? "You can update your profile while ProSoc reviews your registration, but you won't be matched to requirements until approved."
              : vendor.status === "REJECTED"
                ? `Rejected${vendor.rejectionReason ? `: ${vendor.rejectionReason}` : "."}`
                : "Your account is suspended — contact ProSoc support."}
          </p>
        </Card>
      )}

      <Card>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 sm:gap-x-0 sm:divide-x sm:divide-border-subtle">
          {submittedBids !== null && (
            <DashboardStat label="Quotes submitted (12m)" value={String(submittedBids)} href={`/vendor/${id}/bids`} />
          )}
          {totalValueWon !== null && (
            <DashboardStat
              label="Total value won"
              value={`₹${(totalValueWon._sum.totalAmount ?? 0).toString()}`}
              href={`/vendor/${id}/bids?status=WON`}
            />
          )}
          {avgResponseMs !== null && (
            <DashboardStat
              label="Avg. response time"
              value={formatDuration(avgResponseMs)}
              hint="Matched to quoted"
            />
          )}
          {missedInvitesCount !== null && (
            <DashboardStat
              label="Missed invites (90d)"
              value={String(missedInvitesCount)}
              href={`/vendor/${id}/requirements?filter=missed`}
              valueClassName={missedInvitesCount > 0 ? "text-status-error" : undefined}
              hint="Deadline passed, no quote"
            />
          )}
        </div>
      </Card>

      {openInviteCount !== null && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold text-text-primary">
              {openInviteCount === 1
                ? "Following 1 requirement requires your quote"
                : `Following ${openInviteCount} requirements require your quote`}
            </p>
            {openInviteCount > OPEN_INVITE_LIST_LIMIT && (
              <Link
                href={`/vendor/${id}/requirements`}
                className="text-[13px] font-medium text-accent-primary underline"
              >
                View all
              </Link>
            )}
          </div>
          {openInviteCount === 0 ? (
            <p className="text-[13px] text-text-secondary">
              No open invites right now — check back once new requirements are matched.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {openInviteList?.map((invite) => {
                const req = invite.requirement;
                const societyLabel = invite.contactRevealedAt
                  ? req.society.name
                  : `Society in ${req.society.city.name}`;
                return (
                  <Link
                    key={invite.id}
                    href={`/vendor/${id}/requirements/${req.id}`}
                    className="flex flex-col gap-1 rounded-lg border border-border-subtle p-3 transition-shadow hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p className="text-[14px] font-medium text-text-primary">
                      {req.name} — {societyLabel}
                    </p>
                    <p className="text-[13px] font-medium whitespace-nowrap text-status-warning">
                      {formatDateTime(req.bidDeadline)}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function DashboardStat({
  label,
  value,
  href,
  hint,
  valueClassName,
}: {
  label: string;
  value: string;
  href?: string;
  hint?: string;
  valueClassName?: string;
}) {
  const content = (
    <div className="flex flex-col items-center gap-1 text-center sm:px-4 sm:first:pl-0">
      <p className="text-[12px] font-medium text-text-secondary">{label}</p>
      <p className={`text-[22px] font-bold tracking-tight text-text-primary ${valueClassName ?? ""}`}>{value}</p>
      {hint && <p className="text-[12px] text-text-tertiary">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="transition-opacity hover:opacity-70">
      {content}
    </Link>
  ) : (
    content
  );
}
