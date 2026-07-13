import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorAssignment } from "@/lib/vendor-auth";
import { WorkspaceNav } from "@/components/ui/workspace-nav";

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
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 md:flex-row md:gap-10">
      <aside className="flex shrink-0 flex-col gap-5 md:w-56">
        <div>
          <p className="text-[16px] font-bold tracking-tight text-text-primary">{vendor.name}</p>
          <p className="text-[13px] font-medium text-text-secondary">{assignment.role}</p>
        </div>
        <div className="md:hidden">
          <WorkspaceNav basePath={`/vendor/${id}`} items={navItems} orientation="horizontal" />
        </div>
        <div className="hidden border-r border-border-subtle pr-4 md:block">
          <WorkspaceNav basePath={`/vendor/${id}`} items={navItems} orientation="vertical" />
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
