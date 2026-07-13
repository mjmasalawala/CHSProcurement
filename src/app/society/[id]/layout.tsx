import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyAssignment } from "@/lib/society-auth";
import { WorkspaceNav } from "@/components/ui/workspace-nav";

const NAV_ITEMS = [
  { suffix: "", label: "Dashboard", permissions: [] },
  { suffix: "/requirements", label: "Requirements", permissions: [PERMISSIONS.CREATE_REQUIREMENT] },
  { suffix: "/archive", label: "Archive", permissions: [PERMISSIONS.VIEW_ARCHIVE] },
  // Reachable by MANAGE_USERS (Secretary's invite/deactivate) OR either
  // member-removal permission (any Office Bearer's propose/decide) — see
  // members/page.tsx, which checks each independently for the specific
  // actions it unlocks.
  {
    suffix: "/members",
    label: "Members",
    permissions: [PERMISSIONS.MANAGE_USERS, PERMISSIONS.PROPOSE_MEMBER_REMOVAL, PERMISSIONS.APPROVE_MEMBER_REMOVAL],
  },
  { suffix: "/settings", label: "Settings", permissions: [] },
] as const;

export default async function SocietyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const society = await prisma.society.findUnique({ where: { id }, select: { name: true } });
  if (!society) notFound();

  const assignment = await requireSocietyAssignment(id, `/society/${id}`);
  const visibleNav = NAV_ITEMS.filter(
    (item) => item.permissions.length === 0 || item.permissions.some((p) => assignment.permissions.includes(p)),
  );
  const navItems = visibleNav.map((item) => ({ href: `/society/${id}${item.suffix}`, label: item.label }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 md:flex-row md:gap-10">
      <aside className="flex shrink-0 flex-col gap-5 md:w-56">
        <div>
          <p className="text-[16px] font-bold tracking-tight text-text-primary">{society.name}</p>
          <p className="text-[13px] font-medium text-text-secondary">{assignment.role}</p>
        </div>
        <div className="md:hidden">
          <WorkspaceNav basePath={`/society/${id}`} items={navItems} orientation="horizontal" />
        </div>
        <div className="hidden border-r border-border-subtle pr-4 md:block">
          <WorkspaceNav basePath={`/society/${id}`} items={navItems} orientation="vertical" />
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
