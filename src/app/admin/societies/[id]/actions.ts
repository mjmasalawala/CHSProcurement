"use server";

import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireActionPermission } from "@/lib/admin-auth";
import { createInvite } from "@/lib/invite";
import { notifyRejection } from "@/lib/email";
import { revalidatePath } from "next/cache";

export async function approveSociety(societyId: string): Promise<{ inviteUrl: string }> {
  await requireActionPermission(PERMISSIONS.SOCIETY_QUEUE_ACCESS);

  const society = await prisma.society.update({
    where: { id: societyId },
    data: { status: "ACTIVE" },
  });

  const { url } = await createInvite({
    email: society.secretaryEmail,
    entityType: "SOCIETY",
    entityId: society.id,
    role: "SECRETARY",
  });

  revalidatePath(`/admin/societies/${societyId}`);
  revalidatePath("/admin/societies");
  return { inviteUrl: url };
}

export async function rejectSociety(societyId: string, reason: string): Promise<void> {
  await requireActionPermission(PERMISSIONS.SOCIETY_QUEUE_ACCESS);

  const society = await prisma.society.update({
    where: { id: societyId },
    data: { status: "REJECTED", rejectionReason: reason || null },
  });

  await notifyRejection({
    type: "Society",
    name: society.name,
    contactEmail: society.secretaryEmail,
    reason,
  });

  revalidatePath(`/admin/societies/${societyId}`);
  revalidatePath("/admin/societies");
}
