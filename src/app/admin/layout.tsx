import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { WorkspaceNav } from "@/components/ui/workspace-nav";

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
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 md:flex-row md:gap-10">
      <aside className="flex shrink-0 flex-col gap-5 md:w-56">
        <p className="text-[16px] font-bold tracking-tight text-text-primary">ProSoc Admin</p>
        <div className="md:hidden">
          <WorkspaceNav basePath="/admin" items={navItems} orientation="horizontal" />
        </div>
        <div className="hidden border-r border-border-subtle pr-4 md:block">
          <WorkspaceNav basePath="/admin" items={navItems} orientation="vertical" />
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
