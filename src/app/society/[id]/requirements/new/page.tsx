import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyPagePermission } from "@/lib/society-auth";
import { MIN_ACTIVE_OFFICE_BEARERS, countActiveOfficeBearers } from "@/lib/society-ob";
import { Card } from "@/components/ui/card";
import { RequirementWizard } from "./wizard";

export const dynamic = "force-dynamic";

export default async function NewRequirementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSocietyPagePermission(id, PERMISSIONS.CREATE_REQUIREMENT, `/society/${id}/requirements/new`);

  const obCount = await countActiveOfficeBearers(id);
  if (obCount < MIN_ACTIVE_OFFICE_BEARERS) {
    return (
      <Card className="flex flex-col gap-2 border-status-warning">
        <p className="text-[15px] font-medium text-text-primary">At least 2 Office Bearers required</p>
        <p className="text-[13px] text-text-secondary">
          This society only has {obCount} active Office Bearer{obCount === 1 ? "" : "s"} (Chairman/Secretary/
          Treasurer). A requirement can&apos;t be raised until at least {MIN_ACTIVE_OFFICE_BEARERS} are
          active, since quotation approval needs 2 signoffs.
        </p>
        <Link href={`/society/${id}/members`} className="text-[13px] text-accent-primary underline">
          Invite Office Bearers
        </Link>
      </Card>
    );
  }

  const categories = await prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return <RequirementWizard societyId={id} categories={categories} />;
}
