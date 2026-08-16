"use server";

import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireActionPermission } from "@/lib/admin-auth";
import { resendInvite } from "@/lib/invite";
import { revalidatePath } from "next/cache";

/**
 * Regenerates the activation email for a society picked by name from the
 * Societies list — for when the Secretary (or whoever was actually
 * invited) has lost the original email from approveSociety and an admin
 * doesn't necessarily know which member row to resend from. Resolves the
 * same invitee approveSociety originally invited (society.inviteeRole/Email,
 * falling back to the registrant) rather than resending to just anyone with
 * a role at this society.
 */
export async function resendSocietyActivationEmail(societyId: string): Promise<{ error: string } | undefined> {
  await requireActionPermission(PERMISSIONS.SOCIETY_QUEUE_ACCESS);

  const society = await prisma.society.findUnique({ where: { id: societyId } });
  if (!society) return { error: "Society not found." };
  if (society.status !== "ACTIVE") {
    return { error: "This society hasn't been approved yet, so no activation email has been sent." };
  }

  const inviteeRole = society.inviteeRole ?? society.registrantRole;
  const inviteeEmail = society.inviteeEmail ?? society.registrantEmail;

  const roleAssignment = await prisma.roleAssignment.findFirst({
    where: {
      entityType: "SOCIETY",
      entityId: societyId,
      role: inviteeRole,
      user: { email: inviteeEmail },
    },
  });

  if (!roleAssignment) {
    return { error: "No invite record found for this society's account manager." };
  }
  if (roleAssignment.status !== "PENDING") {
    return { error: "That invite has already been accepted — there's no pending activation email to resend." };
  }

  const result = await resendInvite(roleAssignment.id);
  revalidatePath(`/admin/societies/${societyId}`);
  return result;
}
