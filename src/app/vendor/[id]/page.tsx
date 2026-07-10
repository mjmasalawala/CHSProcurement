import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorAssignment } from "@/lib/vendor-auth";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function VendorDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assignment = await requireVendorAssignment(id, `/vendor/${id}`);

  const vendor = await prisma.vendorCompany.findUniqueOrThrow({ where: { id } });

  const [openInvites, submittedBids] = await Promise.all([
    assignment.permissions.includes(PERMISSIONS.VIEW_REQUIREMENTS_INBOX)
      ? prisma.requirementInvite.count({
          where: { vendorCompanyId: id, requirement: { bidDeadline: { gt: new Date() } } },
        })
      : null,
    assignment.permissions.includes(PERMISSIONS.VIEW_OWN_BIDS)
      ? prisma.bid.count({ where: { vendorCompanyId: id } })
      : null,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[24px] font-bold text-text-primary">Dashboard</h1>

      {vendor.status !== "ACTIVE" && (
        <Card className="border-status-warning">
          <p className="text-[15px] font-medium text-text-primary">Account status: {vendor.status}</p>
          <p className="mt-1 text-[13px] text-text-secondary">
            {vendor.status === "PENDING_VERIFICATION"
              ? "You can update your profile while ProSoc reviews your registration, but you won't be matched to requirements until approved."
              : vendor.status === "REJECTED"
                ? `Rejected${vendor.rejectionReason ? `: ${vendor.rejectionReason}` : "."}`
                : "Your account is suspended — contact ProSoc support."}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {openInvites !== null && (
          <Link href={`/vendor/${id}/requirements`}>
            <Card>
              <p className="text-[13px] text-text-secondary">Open requirement invites</p>
              <p className="text-[24px] font-bold text-text-primary">{openInvites}</p>
            </Card>
          </Link>
        )}
        {submittedBids !== null && (
          <Link href={`/vendor/${id}/bids`}>
            <Card>
              <p className="text-[13px] text-text-secondary">Bids submitted</p>
              <p className="text-[24px] font-bold text-text-primary">{submittedBids}</p>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
