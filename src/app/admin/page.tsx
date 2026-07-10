import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/admin");

  const perms = new Set(session.user.roleAssignments.flatMap((ra) => ra.permissions));

  const [pendingVendors, pendingSocieties, pendingCategoryRequests] = await Promise.all([
    perms.has(PERMISSIONS.VENDOR_QUEUE_ACCESS)
      ? prisma.vendorCompany.count({ where: { status: "PENDING_VERIFICATION" } })
      : null,
    perms.has(PERMISSIONS.SOCIETY_QUEUE_ACCESS)
      ? prisma.society.count({ where: { status: "PENDING_VERIFICATION" } })
      : null,
    perms.has(PERMISSIONS.TAXONOMY_MANAGEMENT)
      ? prisma.categoryRequest.count({ where: { status: "PENDING" } })
      : null,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[24px] font-bold text-text-primary">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {pendingVendors !== null && (
          <Link href="/admin/vendors?status=PENDING_VERIFICATION">
            <Card>
              <p className="text-[13px] text-text-secondary">Vendors pending review</p>
              <p className="text-[24px] font-bold text-text-primary">{pendingVendors}</p>
            </Card>
          </Link>
        )}
        {pendingSocieties !== null && (
          <Link href="/admin/societies?status=PENDING_VERIFICATION">
            <Card>
              <p className="text-[13px] text-text-secondary">Societies pending review</p>
              <p className="text-[24px] font-bold text-text-primary">{pendingSocieties}</p>
            </Card>
          </Link>
        )}
        {pendingCategoryRequests !== null && (
          <Link href="/admin/category-requests">
            <Card>
              <p className="text-[13px] text-text-secondary">Category requests pending</p>
              <p className="text-[24px] font-bold text-text-primary">{pendingCategoryRequests}</p>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
