import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions";

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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-center justify-between">
        <span className="text-[18px] font-semibold text-text-primary">ProSoc Admin</span>
        <Link href="/app" className="text-[13px] text-text-secondary underline hover:text-text-primary">
          Back to app
        </Link>
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-border-subtle pb-4">
        {visibleNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:bg-background-secondary hover:text-text-primary"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
