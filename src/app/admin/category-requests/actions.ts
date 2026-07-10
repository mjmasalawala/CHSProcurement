"use server";

import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireActionPermission } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";

// Approving creates (or reactivates) a real Category with the requested name
// and connects the requesting vendor to it — the whole point of the request
// was "I do this trade, please add it," so leaving the vendor unconnected
// after approval would mean re-doing their own ask manually.
export async function approveCategoryRequest(requestId: string): Promise<void> {
  await requireActionPermission(PERMISSIONS.TAXONOMY_MANAGEMENT);

  const request = await prisma.categoryRequest.findUniqueOrThrow({ where: { id: requestId } });

  const category = await prisma.category.upsert({
    where: { name: request.name },
    update: { active: true },
    create: { name: request.name },
  });

  await prisma.categoryRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED" },
  });

  if (request.vendorCompanyId) {
    await prisma.vendorCompany.update({
      where: { id: request.vendorCompanyId },
      data: { serviceCategories: { connect: { id: category.id } } },
    });
  }

  revalidatePath("/admin/category-requests");
  revalidatePath("/admin/categories");
}

export async function rejectCategoryRequest(requestId: string): Promise<void> {
  await requireActionPermission(PERMISSIONS.TAXONOMY_MANAGEMENT);

  await prisma.categoryRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED" },
  });

  revalidatePath("/admin/category-requests");
}
