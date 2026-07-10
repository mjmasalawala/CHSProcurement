"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { createInvite } from "@/lib/invite";
import { notifyRejection } from "@/lib/email";
import { revalidatePath } from "next/cache";

// session.user.roleAssignments is already ACTIVE-only (see auth.ts jwt
// callback), so a plain permissions.includes() check is sufficient here.
async function requireSocietyQueueAccess() {
  const session = await auth();
  const assignment = session?.user.roleAssignments.find((ra) =>
    ra.permissions.includes(PERMISSIONS.SOCIETY_QUEUE_ACCESS),
  );
  if (!assignment) throw new Error("Not authorized.");
}

export async function approveSociety(societyId: string): Promise<{ inviteUrl: string }> {
  await requireSocietyQueueAccess();

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
  return { inviteUrl: url };
}

export async function rejectSociety(societyId: string, reason: string): Promise<void> {
  await requireSocietyQueueAccess();

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
}
