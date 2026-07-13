"use server";

import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyActionPermission } from "@/lib/society-auth";
import { createInvite, resendInvite } from "@/lib/invite";
import { revalidatePath } from "next/cache";
import type { RoleName } from "@/generated/prisma/enums";

// Secretary is invited once by ProSoc Ops on society approval (M3) and isn't
// managed from here — this covers society-portal-spec.md Section 3's "the
// Secretary then invites the Manager (if not already the registrant),
// Chairman, and Treasurer."
const INVITABLE_ROLES: RoleName[] = ["MANAGER", "CHAIRMAN", "TREASURER"];

// Chairman and Treasurer are single-seat posts — inviting a second person
// while one is ACTIVE would leave two people holding the same OB vote.
// Manager is exempt: a society can have more than one (society-portal-spec.md
// Section 2).
const SINGLE_SEAT_ROLES: RoleName[] = ["CHAIRMAN", "TREASURER"];

export async function inviteMember(
  societyId: string,
  email: string,
  role: RoleName,
): Promise<{ error: string } | undefined> {
  await requireSocietyActionPermission(societyId, PERMISSIONS.MANAGE_USERS);

  if (!INVITABLE_ROLES.includes(role)) return { error: "Invalid role." };

  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Email is required." };

  if (SINGLE_SEAT_ROLES.includes(role)) {
    const activeHolder = await prisma.roleAssignment.findFirst({
      where: { entityType: "SOCIETY", entityId: societyId, role, status: "ACTIVE" },
    });
    if (activeHolder) {
      return { error: `This society already has an active ${role.toLowerCase()} — deactivate them first.` };
    }
  }

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

  const { emailError } = await createInvite({ email: trimmed, entityType: "SOCIETY", entityId: societyId, role });

  revalidatePath(`/society/${societyId}/members`);
  if (emailError) {
    return { error: "Invite created, but the email failed to send. Please contact support." };
  }
}

export async function resendMemberInvite(
  societyId: string,
  roleAssignmentId: string,
): Promise<{ error: string } | undefined> {
  await requireSocietyActionPermission(societyId, PERMISSIONS.MANAGE_USERS);

  const assignment = await prisma.roleAssignment.findFirst({
    where: { id: roleAssignmentId, entityType: "SOCIETY", entityId: societyId, status: "PENDING" },
  });
  if (!assignment) return { error: "No pending invite to resend." };

  return resendInvite(roleAssignmentId);
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
