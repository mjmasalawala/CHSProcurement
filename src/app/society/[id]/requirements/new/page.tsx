import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyPagePermission } from "@/lib/society-auth";
import { RequirementWizard } from "./wizard";

export const dynamic = "force-dynamic";

export default async function NewRequirementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSocietyPagePermission(id, PERMISSIONS.CREATE_REQUIREMENT, `/society/${id}/requirements/new`);

  const categories = await prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return <RequirementWizard societyId={id} categories={categories} />;
}
