"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireActionPermission } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";

export async function createCity(name: string): Promise<{ error: string } | undefined> {
  await requireActionPermission(PERMISSIONS.CITY_MANAGEMENT);

  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };

  try {
    await prisma.city.create({ data: { name: trimmed } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "A city with this name already exists." };
    }
    throw err;
  }

  revalidatePath("/admin/cities");
}

export async function setCityActive(id: string, active: boolean): Promise<void> {
  await requireActionPermission(PERMISSIONS.CITY_MANAGEMENT);

  await prisma.city.update({ where: { id }, data: { active } });

  revalidatePath("/admin/cities");
}
