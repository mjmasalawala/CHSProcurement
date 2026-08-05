import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorAssignment } from "@/lib/vendor-auth";
import { WorkspaceShell } from "@/components/ui/workspace-shell";

const NAV_ITEMS = [
  { suffix: "", label: "Dashboard", permission: null },
  { suffix: "/profile", label: "Profile", permission: PERMISSIONS.EDIT_COMPANY_PROFILE },
  { suffix: "/requirements", label: "Requirements", permission: PERMISSIONS.VIEW_REQUIREMENTS_INBOX },
  { suffix: "/bids", label: "My Quotes", permission: PERMISSIONS.VIEW_OWN_BIDS },
  { suffix: "/staff", label: "Staff", permission: PERMISSIONS.MANAGE_STAFF },
] as const;

export default async function VendorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const vendor = await prisma.vendorCompany.findUnique({ where: { id }, select: { name: true } });
  if (!vendor) notFound();

  const assignment = await requireVendorAssignment(id, `/vendor/${id}`);
  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.permission || assignment.permissions.includes(item.permission),
  );
  const navItems = visibleNav.map((item) => ({ href: `/vendor/${id}${item.suffix}`, label: item.label }));

  return (
    <WorkspaceShell title={vendor.name} subtitle={assignment.role} basePath={`/vendor/${id}`} items={navItems}>
      {children}
    </WorkspaceShell>
  );
}
