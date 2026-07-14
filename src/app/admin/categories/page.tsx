import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePagePermission } from "@/lib/admin-auth";
import { AddCategoryForm, ToggleActiveButton, RenameCategoryButton } from "./controls";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await requirePagePermission(PERMISSIONS.TAXONOMY_MANAGEMENT, "/admin/categories");

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Categories</h1>

      <AddCategoryForm />

      <div className="flex flex-col gap-2">
        {categories.map((category) => (
          <div
            key={category.id}
            className="flex items-center justify-between rounded-lg border border-border-subtle p-4"
          >
            <div>
              <p className="text-[15px] font-medium text-text-primary">{category.name}</p>
              <p className="text-[13px] text-text-secondary">
                {category.active ? "Active" : "Inactive"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <RenameCategoryButton id={category.id} name={category.name} />
              <ToggleActiveButton id={category.id} active={category.active} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
