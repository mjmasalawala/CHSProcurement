import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorPagePermission } from "@/lib/vendor-auth";
import { Card } from "@/components/ui/card";
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
      include: { submittedByUser: true, requirement: { select: { description: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[24px] font-bold text-text-primary">Staff</h1>

      <Card>
        <InviteStaffForm vendorCompanyId={id} />
      </Card>

      <div className="flex flex-col gap-2">
        {staff.length === 0 && <p className="text-[13px] text-text-secondary">No staff invited yet.</p>}
        {staff.map((ra) => (
          <div
            key={ra.id}
            className="flex items-center justify-between rounded-lg border border-border-subtle p-4"
          >
            <div>
              <p className="text-[15px] font-medium text-text-primary">{ra.user.name ?? ra.user.email}</p>
              <p className="text-[13px] text-text-secondary">
                {ra.user.email} · {ra.status}
              </p>
            </div>
            {ra.status !== "PENDING" && (
              <ToggleStaffButton
                vendorCompanyId={id}
                roleAssignmentId={ra.id}
                active={ra.status === "ACTIVE"}
              />
            )}
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
              <div key={bid.id} className="rounded-lg border border-border-subtle p-3">
                <p className="text-[13px] text-text-primary">
                  <span className="font-medium">{bid.submittedByUser.name ?? bid.submittedByUser.email}</span>{" "}
                  submitted a bid on &ldquo;{bid.requirement.description.slice(0, 60)}&rdquo;
                </p>
                <p className="text-[13px] text-text-secondary">
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
