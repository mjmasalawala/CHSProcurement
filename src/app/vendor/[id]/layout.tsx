import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorAssignment } from "@/lib/vendor-auth";

const NAV_ITEMS = [
  { suffix: "", label: "Dashboard", permission: null },
  { suffix: "/profile", label: "Profile", permission: PERMISSIONS.EDIT_COMPANY_PROFILE },
  { suffix: "/requirements", label: "Requirements", permission: PERMISSIONS.VIEW_REQUIREMENTS_INBOX },
  { suffix: "/bids", label: "My Bids", permission: PERMISSIONS.VIEW_OWN_BIDS },
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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[18px] font-semibold text-text-primary">{vendor.name}</span>
          <p className="text-[13px] text-text-secondary">{assignment.role}</p>
        </div>
        <Link href="/app" className="text-[13px] text-text-secondary underline hover:text-text-primary">
          Back to app
        </Link>
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-border-subtle pb-4">
        {visibleNav.map((item) => (
          <Link
            key={item.suffix}
            href={`/vendor/${id}${item.suffix}`}
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
