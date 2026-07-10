"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireActionPermission } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";

export async function createCategory(name: string): Promise<{ error: string } | undefined> {
  await requireActionPermission(PERMISSIONS.TAXONOMY_MANAGEMENT);

  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };

  try {
    await prisma.category.create({ data: { name: trimmed } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "A category with this name already exists." };
    }
    throw err;
  }

  revalidatePath("/admin/categories");
}

export async function setCategoryActive(id: string, active: boolean): Promise<void> {
  await requireActionPermission(PERMISSIONS.TAXONOMY_MANAGEMENT);

  await prisma.category.update({ where: { id }, data: { active } });

  revalidatePath("/admin/categories");
}
