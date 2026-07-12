import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorPagePermission } from "@/lib/vendor-auth";
import { Badge, type BadgeTone } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function statusFor(
  deadline: Date,
  bidStatus: "SUBMITTED" | "WON" | "NOT_SELECTED" | null,
): { label: string; tone: BadgeTone } {
  const closed = deadline.getTime() <= Date.now();
  if (!bidStatus) return closed ? { label: "Not Selected", tone: "neutral" } : { label: "New", tone: "info" };
  if (bidStatus === "WON") return { label: "Won", tone: "success" };
  if (bidStatus === "NOT_SELECTED") return { label: "Not Selected", tone: "neutral" };
  return { label: "Bid Submitted", tone: "info" };
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
      <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Requirements Inbox</h1>

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
                className="flex items-center justify-between rounded-xl border border-border-subtle bg-background-primary p-4 shadow-xs transition-shadow hover:shadow-sm"
              >
                <div>
                  <p className="text-[15px] font-semibold text-text-primary">
                    {req.category.name} — {req.society.name}
                  </p>
                  <p className="text-[13px] text-text-secondary">{req.description.slice(0, 80)}</p>
                  <p className="text-[13px] text-text-tertiary">
                    Deadline: {req.bidDeadline.toLocaleString()}
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
