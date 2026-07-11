"use server";

import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyActionPermission } from "@/lib/society-auth";
import { createInvite } from "@/lib/invite";
import { revalidatePath } from "next/cache";
import type { RoleName } from "@/generated/prisma/enums";

// Secretary is invited once by ProSoc Ops on society approval (M3) and isn't
// managed from here — this covers society-portal-spec.md Section 3's "the
// Secretary then invites the Manager (if not already the registrant),
// Chairman, and Treasurer."
const INVITABLE_ROLES: RoleName[] = ["MANAGER", "CHAIRMAN", "TREASURER"];

export async function inviteMember(
  societyId: string,
  email: string,
  role: RoleName,
): Promise<{ error: string } | undefined> {
  await requireSocietyActionPermission(societyId, PERMISSIONS.MANAGE_USERS);

  if (!INVITABLE_ROLES.includes(role)) return { error: "Invalid role." };

  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Email is required." };

  const existing = await prisma.roleAssignment.findFirst({
    where: {
      entityType: "SOCIETY",
      entityId: societyId,
      role,
      status: { in: ["PENDING", "ACTIVE"] },
      user: { email: trimmed },
    },
  });
  if (existing) return { error: "This person already has this role (or a pending invite)." };

  await createInvite({ email: trimmed, entityType: "SOCIETY", entityId: societyId, role });

  revalidatePath(`/society/${societyId}/members`);
}

export async function setMemberActive(
  societyId: string,
  roleAssignmentId: string,
  active: boolean,
): Promise<void> {
  await requireSocietyActionPermission(societyId, PERMISSIONS.MANAGE_USERS);

  await prisma.roleAssignment.updateMany({
    where: {
      id: roleAssignmentId,
      entityType: "SOCIETY",
      entityId: societyId,
      role: { in: INVITABLE_ROLES },
      status: { in: ["ACTIVE", "DEACTIVATED"] },
    },
    data: { status: active ? "ACTIVE" : "DEACTIVATED" },
  });

  revalidatePath(`/society/${societyId}/members`);
}
