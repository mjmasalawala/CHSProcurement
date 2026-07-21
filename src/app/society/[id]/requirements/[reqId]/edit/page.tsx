import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyPagePermission } from "@/lib/society-auth";
import { Card } from "@/components/ui/card";
import { EditRequirementForm } from "./edit-form";

export const dynamic = "force-dynamic";

export default async function EditRequirementPage({
  params,
}: {
  params: Promise<{ id: string; reqId: string }>;
}) {
  const { id, reqId } = await params;
  await requireSocietyPagePermission(id, PERMISSIONS.CREATE_REQUIREMENT, `/society/${id}/requirements/${reqId}/edit`);

  const requirement = await prisma.requirement.findUnique({
    where: { id: reqId },
    include: { categories: true, bids: { select: { id: true } } },
  });
  if (!requirement || requirement.societyId !== id) notFound();

  // Mirrors the guard in updateRequirement — kept here too so a Manager
  // can't even land on the form once it's no longer editable.
  if (requirement.status !== "OPEN" || requirement.bids.length > 0) {
    redirect(`/society/${id}/requirements/${reqId}`);
  }

  const categories = await prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/society/${id}/requirements/${reqId}`}
        className="text-[13px] text-text-secondary underline hover:text-text-primary"
      >
        ← Back to Requirement
      </Link>

      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Edit Requirement</h1>
        <p className="text-[13px] text-text-secondary">
          You can edit this until a vendor submits a quote — after that, it&apos;s locked to keep quotes
          comparable against what vendors actually saw.
        </p>
      </div>

      <Card>
        <EditRequirementForm
          societyId={id}
          requirementId={reqId}
          categories={categories}
          initial={{
            categoryIds: requirement.categories.map((c) => c.id),
            name: requirement.name,
            description: requirement.description,
            bidDeadline: requirement.bidDeadline.toISOString().slice(0, 16),
          }}
        />
      </Card>
    </div>
  );
}
