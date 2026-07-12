import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorPagePermission } from "@/lib/vendor-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-badge";
import { InviteStaffForm, ToggleStaffButton } from "./controls";

export const dynamic = "force-dynamic";

export default async function VendorStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireVendorPagePermission(id, PERMISSIONS.MANAGE_STAFF, `/vendor/${id}/staff`);

  const [staff, bids] = await Promise.all([
    prisma.roleAssignment.findMany({
      where: { entityType: "VENDOR_COMPANY", entityId: id, role: "VENDOR_STAFF" },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.bid.findMany({
      where: { vendorCompanyId: id },
      include: { submittedByUser: true, requirement: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Staff</h1>

      <Card>
        <InviteStaffForm vendorCompanyId={id} />
      </Card>

      <div className="flex flex-col gap-2">
        {staff.length === 0 && <p className="text-[13px] text-text-secondary">No staff invited yet.</p>}
        {staff.map((ra) => (
          <div
            key={ra.id}
            className="flex items-center justify-between rounded-xl border border-border-subtle bg-background-primary p-4 shadow-xs"
          >
            <div>
              <p className="text-[15px] font-semibold text-text-primary">{ra.user.name ?? ra.user.email}</p>
              <p className="text-[13px] text-text-secondary">{ra.user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={statusTone(ra.status)}>{statusLabel(ra.status)}</Badge>
              {ra.status !== "PENDING" && (
                <ToggleStaffButton
                  vendorCompanyId={id}
                  roleAssignmentId={ra.id}
                  active={ra.status === "ACTIVE"}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-[18px] font-semibold text-text-primary">Staff activity log</h2>
        {bids.length === 0 ? (
          <p className="text-[13px] text-text-secondary">No bids submitted yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {bids.map((bid) => (
              <div key={bid.id} className="rounded-lg border border-border-subtle bg-background-primary p-3 shadow-xs">
                <p className="text-[13px] text-text-primary">
                  <span className="font-semibold">{bid.submittedByUser.name ?? bid.submittedByUser.email}</span>{" "}
                  submitted a bid on &ldquo;{bid.requirement.name}&rdquo;
                </p>
                <p className="text-[13px] text-text-tertiary">
                  {bid.createdAt.toLocaleString()} · ₹{bid.totalAmount.toString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
