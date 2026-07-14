import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorPagePermission } from "@/lib/vendor-auth";
import type { BidStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-badge";
import { formatDateTime } from "@/lib/date";

export const dynamic = "force-dynamic";

const TABS: { value: BidStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "WON", label: "Selected" },
  { value: "NOT_SELECTED", label: "Not Selected" },
];

export default async function VendorBidsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const assignment = await requireVendorPagePermission(id, PERMISSIONS.VIEW_OWN_BIDS, `/vendor/${id}/bids`);
  const session = await auth();

  const { status } = await searchParams;
  const activeTab = TABS.some((t) => t.value === status) ? (status as BidStatus | "ALL") : "ALL";

  const isOwner = assignment.role === "VENDOR_OWNER";

  const bids = await prisma.bid.findMany({
    where: {
      vendorCompanyId: id,
      ...(activeTab === "ALL" ? {} : { status: activeTab }),
      ...(isOwner ? {} : { submittedByUserId: session?.user.id }),
    },
    include: {
      requirement: { include: { categories: true, society: { select: { name: true } } } },
      submittedByUser: { select: { name: true, email: true } },
      workOrder: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-bold tracking-tight text-text-primary">My Quotes / History</h1>

      <div className="flex gap-1 border-b border-border-subtle pb-3">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/vendor/${id}/bids?status=${tab.value}`}
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

      {bids.length === 0 ? (
        <p className="text-[13px] text-text-secondary">No quotes here.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {bids.map((bid) => (
            <div
              key={bid.id}
              className="flex items-center justify-between rounded-xl border border-border-subtle bg-background-primary p-4 shadow-xs transition-shadow hover:shadow-sm"
            >
              <Link href={`/vendor/${id}/requirements/${bid.requirementId}`} className="flex-1">
                <p className="text-[15px] font-semibold text-text-primary">
                  {bid.requirement.categories.map((c) => c.name).join(", ")} — {bid.requirement.society.name}
                </p>
                <p className="text-[13px] text-text-secondary">
                  ₹{bid.totalAmount.toString()} · submitted by {bid.submittedByUser.name ?? bid.submittedByUser.email}
                </p>
                <p className="text-[13px] text-text-tertiary">{formatDateTime(bid.createdAt)}</p>
              </Link>
              <div className="flex flex-col items-end gap-1.5">
                <Badge tone={statusTone(bid.status)}>{statusLabel(bid.status)}</Badge>
                {bid.workOrder && (
                  <a
                    href={`/api/work-orders/${bid.workOrder.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] font-medium text-accent-primary underline"
                  >
                    Work Order PDF
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
