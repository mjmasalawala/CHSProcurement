"use server";

import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireActionPermission } from "@/lib/admin-auth";
import { resendInvite } from "@/lib/invite";
import { revalidatePath } from "next/cache";

const SEARCH_RESULT_LIMIT = 8;
const SEARCH_MIN_QUERY_LENGTH = 2;

/**
 * Live search behind the "Resend activation email" dropdown — returns only
 * whatever the current query matches (active societies by name), rather
 * than shipping every active society to the browser up front for
 * client-side filtering.
 */
export async function searchActiveSocieties(query: string): Promise<{ id: string; label: string }[]> {
  await requireActionPermission(PERMISSIONS.SOCIETY_QUEUE_ACCESS);

  const trimmed = query.trim();
  if (trimmed.length < SEARCH_MIN_QUERY_LENGTH) return [];

  const societies = await prisma.society.findMany({
    where: { status: "ACTIVE", name: { contains: trimmed, mode: "insensitive" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: SEARCH_RESULT_LIMIT,
  });

  return societies.map((s) => ({ id: s.id, label: s.name }));
}

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
