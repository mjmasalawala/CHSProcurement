import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyAssignment } from "@/lib/society-auth";

const NAV_ITEMS = [
  { suffix: "", label: "Dashboard", permission: null },
  { suffix: "/requirements", label: "Requirements", permission: PERMISSIONS.CREATE_REQUIREMENT },
  { suffix: "/archive", label: "Archive", permission: PERMISSIONS.VIEW_ARCHIVE },
  { suffix: "/settings", label: "Settings", permission: null },
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
    (item) => !item.permission || assignment.permissions.includes(item.permission),
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[18px] font-semibold text-text-primary">{society.name}</span>
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
            href={`/society/${id}${item.suffix}`}
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
