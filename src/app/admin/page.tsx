import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { BarChart } from "@/components/ui/bar-chart";
import { formatDate } from "@/lib/date";
import {
  getVendorApprovalsOverTime,
  getSocietyApprovalsOverTime,
  getVendorOnboardingsOverTime,
  getSocietyOnboardingsOverTime,
  getVendorResponseStats,
  averageResponseHours,
  topRespondingVendors,
  formatResponseHours,
  getSocietiesWithNoRequirements,
} from "@/lib/dashboard-metrics";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/admin");

  const perms = new Set(session.user.roleAssignments.flatMap((ra) => ra.permissions));
  const canVendor = perms.has(PERMISSIONS.VENDOR_QUEUE_ACCESS);
  const canSociety = perms.has(PERMISSIONS.SOCIETY_QUEUE_ACCESS);

  const [
    pendingVendors,
    pendingSocieties,
    pendingCategoryRequests,
    vendorApprovals,
    societyApprovals,
    vendorOnboardings,
    societyOnboardings,
    vendorResponseStats,
    inactiveSocieties,
  ] = await Promise.all([
    canVendor ? prisma.vendorCompany.count({ where: { status: "PENDING_VERIFICATION" } }) : null,
    canSociety ? prisma.society.count({ where: { status: "PENDING_VERIFICATION" } }) : null,
    perms.has(PERMISSIONS.TAXONOMY_MANAGEMENT)
      ? prisma.categoryRequest.count({ where: { status: "PENDING" } })
      : null,
    canVendor ? getVendorApprovalsOverTime() : null,
    canSociety ? getSocietyApprovalsOverTime() : null,
    canVendor ? getVendorOnboardingsOverTime() : null,
    canSociety ? getSocietyOnboardingsOverTime() : null,
    canVendor ? getVendorResponseStats() : null,
    canSociety ? getSocietiesWithNoRequirements() : null,
  ]);

  const weekLabels = vendorApprovals?.weekLabels ?? societyApprovals?.weekLabels ?? [];
  const approvalSeries = [
    vendorApprovals && { label: "Vendors approved", color: "var(--color-accent-primary)", values: vendorApprovals.values },
    societyApprovals && { label: "Societies approved", color: "var(--color-status-success)", values: societyApprovals.values },
  ].filter((s): s is { label: string; color: string; values: number[] } => Boolean(s));

  const onboardingSeries = [
    vendorOnboardings && { label: "New vendors", color: "var(--color-accent-primary)", values: vendorOnboardings.values },
    societyOnboardings && { label: "New societies", color: "var(--color-status-success)", values: societyOnboardings.values },
  ].filter((s): s is { label: string; color: string; values: number[] } => Boolean(s));

  const avgResponse = vendorResponseStats ? averageResponseHours(vendorResponseStats) : null;
  const topVendors = vendorResponseStats ? topRespondingVendors(vendorResponseStats, 10) : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {pendingVendors !== null && (
          <Link href="/admin/vendors?status=PENDING_VERIFICATION">
            <Card>
              <p className="text-[13px] text-text-secondary">Vendors pending review</p>
              <p className="text-[28px] font-bold tracking-tight text-text-primary">{pendingVendors}</p>
            </Card>
          </Link>
        )}
        {pendingSocieties !== null && (
          <Link href="/admin/societies?status=PENDING_VERIFICATION">
            <Card>
              <p className="text-[13px] text-text-secondary">Societies pending review</p>
              <p className="text-[28px] font-bold tracking-tight text-text-primary">{pendingSocieties}</p>
            </Card>
          </Link>
        )}
        {pendingCategoryRequests !== null && (
          <Link href="/admin/category-requests">
            <Card>
              <p className="text-[13px] text-text-secondary">Category requests pending</p>
              <p className="text-[28px] font-bold tracking-tight text-text-primary">{pendingCategoryRequests}</p>
            </Card>
          </Link>
        )}
      </div>

      {approvalSeries.length > 0 && (
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold text-text-primary">Approvals over time</h2>
            <BarChart weekLabels={weekLabels} series={approvalSeries} />
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold text-text-primary">Weekly new onboardings</h2>
            <BarChart weekLabels={weekLabels} series={onboardingSeries} />
          </Card>
        </div>
      )}

      {vendorResponseStats && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="flex flex-col justify-center gap-1 lg:col-span-1">
            <p className="text-[13px] text-text-secondary">Average vendor response time</p>
            <p className="text-[28px] font-bold tracking-tight text-text-primary">
              {avgResponse !== null ? formatResponseHours(avgResponse) : "—"}
            </p>
            <p className="text-[13px] text-text-secondary">Invite to bid submission, across all vendors</p>
          </Card>

          <Card className="flex flex-col gap-3 lg:col-span-2">
            <h2 className="text-[15px] font-semibold text-text-primary">Top 10 quickest responding vendors</h2>
            {topVendors.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-tertiary">
                      <th className="pb-2 pr-2 text-[11px] font-semibold uppercase tracking-wide">#</th>
                      <th className="pb-2 pr-2 text-[11px] font-semibold uppercase tracking-wide">Vendor</th>
                      <th className="pb-2 pr-2 text-[11px] font-semibold uppercase tracking-wide">Avg. response</th>
                      <th className="pb-2 text-[11px] font-semibold uppercase tracking-wide">Bids</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topVendors.map((v, i) => (
                      <tr key={v.vendorCompanyId} className="border-b border-border-subtle last:border-0">
                        <td className="py-2 pr-2 text-text-secondary">{i + 1}</td>
                        <td className="py-2 pr-2 font-medium whitespace-nowrap text-text-primary">
                          {v.vendorName}
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap text-text-secondary">
                          {formatResponseHours(v.avgResponseHours)}
                        </td>
                        <td className="py-2 text-text-secondary">{v.bidCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[13px] text-text-secondary">No bids submitted against an invite yet.</p>
            )}
          </Card>
        </div>
      )}

      {inactiveSocieties && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold text-text-primary">
            Societies with no requirements raised ({inactiveSocieties.length})
          </h2>
          {inactiveSocieties.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border-subtle text-text-tertiary">
                    <th className="pb-2 pr-2 text-[11px] font-semibold uppercase tracking-wide">Society</th>
                    <th className="pb-2 pr-2 text-[11px] font-semibold uppercase tracking-wide">City</th>
                    <th className="pb-2 pr-2 text-[11px] font-semibold uppercase tracking-wide">Secretary</th>
                    <th className="pb-2 text-[11px] font-semibold uppercase tracking-wide">Approved</th>
                  </tr>
                </thead>
                <tbody>
                  {inactiveSocieties.map((s) => (
                    <tr key={s.id} className="border-b border-border-subtle last:border-0">
                      <td className="py-2 pr-2 whitespace-nowrap">
                        <Link
                          href={`/admin/societies/${s.id}`}
                          className="font-medium text-text-primary hover:underline"
                        >
                          {s.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-2 whitespace-nowrap text-text-secondary">{s.cityName}</td>
                      <td className="py-2 pr-2 whitespace-nowrap text-text-secondary">
                        <a href={`mailto:${s.secretaryEmail}`} className="hover:underline">
                          {s.secretaryName}
                        </a>
                      </td>
                      <td className="py-2 whitespace-nowrap text-text-secondary">
                        {s.approvedAt ? formatDate(s.approvedAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-text-secondary">
              Every active society has raised at least one requirement.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
