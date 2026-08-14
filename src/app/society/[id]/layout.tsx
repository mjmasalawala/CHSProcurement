import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyAssignment } from "@/lib/society-auth";
import { WorkspaceShell } from "@/components/ui/workspace-shell";

const NAV_ITEMS = [
  { suffix: "", label: "Dashboard", permissions: [] },
  { suffix: "/requirements", label: "Requirements", permissions: [PERMISSIONS.CREATE_REQUIREMENT] },
  // Reuses CREATE_REQUIREMENT rather than a dedicated permission — the same
  // Manager/Office Bearer set who can raise a requirement can suggest a
  // vendor; split it into its own permission later if that ever needs to
  // diverge.
  { suffix: "/suggest-vendor", label: "Vendor Invite", permissions: [PERMISSIONS.CREATE_REQUIREMENT] },
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
    <WorkspaceShell title={society.name} subtitle={assignment.role} basePath={`/society/${id}`} items={navItems}>
      {children}
    </WorkspaceShell>
  );
}
