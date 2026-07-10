import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorPagePermission } from "@/lib/vendor-auth";

export const dynamic = "force-dynamic";

function statusFor(deadline: Date, bidStatus: "SUBMITTED" | "WON" | "NOT_SELECTED" | null): string {
  const closed = deadline.getTime() <= Date.now();
  if (!bidStatus) return closed ? "Not Selected" : "New";
  if (bidStatus === "WON") return "Won";
  if (bidStatus === "NOT_SELECTED") return "Not Selected";
  return "Bid Submitted";
}

export default async function VendorRequirementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireVendorPagePermission(id, PERMISSIONS.VIEW_REQUIREMENTS_INBOX, `/vendor/${id}/requirements`);

  const invites = await prisma.requirementInvite.findMany({
    where: { vendorCompanyId: id },
    include: {
      requirement: {
        include: {
          category: true,
          society: { select: { name: true } },
          bids: { where: { vendorCompanyId: id }, select: { status: true } },
        },
      },
    },
    orderBy: { requirement: { bidDeadline: "asc" } },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[24px] font-bold text-text-primary">Requirements Inbox</h1>

      {invites.length === 0 ? (
        <p className="text-[13px] text-text-secondary">
          No requirements yet — you&apos;ll see requirements here once ProSoc&apos;s matching engine invites
          you to bid.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {invites.map(({ requirement: req }) => {
            const status = statusFor(req.bidDeadline, req.bids[0]?.status ?? null);
            return (
              <Link
                key={req.id}
                href={`/vendor/${id}/requirements/${req.id}`}
                className="flex items-center justify-between rounded-lg border border-border-subtle p-4 hover:bg-background-secondary"
              >
                <div>
                  <p className="text-[15px] font-medium text-text-primary">
                    {req.category.name} — {req.society.name}
                  </p>
                  <p className="text-[13px] text-text-secondary">{req.description.slice(0, 80)}</p>
                  <p className="text-[13px] text-text-secondary">
                    Deadline: {req.bidDeadline.toLocaleString()}
                  </p>
                </div>
                <p className="text-[13px] font-medium text-text-primary">{status}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
