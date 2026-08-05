import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { WorkspaceShell } from "@/components/ui/workspace-shell";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", permission: null },
  { href: "/admin/vendors", label: "Vendors", permission: PERMISSIONS.VENDOR_QUEUE_ACCESS },
  { href: "/admin/societies", label: "Societies", permission: PERMISSIONS.SOCIETY_QUEUE_ACCESS },
  {
    href: "/admin/category-requests",
    label: "Category Requests",
    permission: PERMISSIONS.TAXONOMY_MANAGEMENT,
  },
  { href: "/admin/categories", label: "Categories", permission: PERMISSIONS.TAXONOMY_MANAGEMENT },
  { href: "/admin/cities", label: "Cities", permission: PERMISSIONS.CITY_MANAGEMENT },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/admin");

  const perms = new Set(session.user.roleAssignments.flatMap((ra) => ra.permissions));
  const hasAnyAdminAccess = [
    PERMISSIONS.VENDOR_QUEUE_ACCESS,
    PERMISSIONS.SOCIETY_QUEUE_ACCESS,
    PERMISSIONS.VENDOR_DIRECTORY_ACCESS,
    PERMISSIONS.SOCIETY_DIRECTORY_ACCESS,
    PERMISSIONS.TAXONOMY_MANAGEMENT,
    PERMISSIONS.CITY_MANAGEMENT,
  ].some((p) => perms.has(p));
  if (!hasAnyAdminAccess) redirect("/app");

  const visibleNav = NAV_ITEMS.filter((item) => !item.permission || perms.has(item.permission));
  const navItems = visibleNav.map((item) => ({ href: item.href, label: item.label }));

  return (
    <WorkspaceShell title="ProSoc Admin" basePath="/admin" items={navItems}>
      {children}
    </WorkspaceShell>
  );
}
