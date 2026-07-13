"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyActionPermission } from "@/lib/society-auth";
import { createInvite, resendInvite } from "@/lib/invite";
import {
  notifyMemberRemovalProposed,
  notifyMemberRemovalDecided,
  notifyMemberRemoved,
} from "@/lib/notifications";
import { OB_ROLES } from "@/lib/society-ob";
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

/**
 * Member removal (society-portal-spec.md Section 7.2) — same generic
 * ProposedChange co-approval pattern as the threshold (settings/actions.ts):
 * one Office Bearer proposes, a different one approves. Unlike
 * Deactivate/Reactivate (instant, single-actor), this permanently deletes
 * the RoleAssignment on approval — the User account itself is untouched
 * (they may hold roles elsewhere), only their access to this society is
 * revoked. All 4 society roles are eligible, including Secretary (product
 * decision, 2026-07-13).
 */
export async function proposeRemoveMember(
  societyId: string,
  roleAssignmentId: string,
): Promise<{ error: string } | undefined> {
  await requireSocietyActionPermission(societyId, PERMISSIONS.PROPOSE_MEMBER_REMOVAL);
  const session = await auth();
  if (!session) return { error: "Not authorized." };

  const target = await prisma.roleAssignment.findFirst({
    where: { id: roleAssignmentId, entityType: "SOCIETY", entityId: societyId, status: "ACTIVE" },
    include: { user: true },
  });
  if (!target) return { error: "This member can't be removed (not found or not active)." };

  const existing = await prisma.proposedChange.findFirst({
    where: { societyId, field: "remove_member", status: "PENDING", oldValue: roleAssignmentId },
  });
  if (existing) return { error: "There's already a pending removal proposal for this member." };

  const targetName = target.user.name ?? target.user.email;

  await prisma.proposedChange.create({
    data: {
      societyId,
      field: "remove_member",
      oldValue: roleAssignmentId,
      newValue: `${targetName} (${target.role})`,
      proposedByUserId: session.user.id,
    },
  });

  const obs = await prisma.roleAssignment.findMany({
    where: {
      entityType: "SOCIETY",
      entityId: societyId,
      role: { in: [...OB_ROLES] },
      status: "ACTIVE",
      userId: { not: session.user.id },
    },
    include: { user: true },
  });
  const society = await prisma.society.findUniqueOrThrow({ where: { id: societyId } });
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await notifyMemberRemovalProposed({
    recipients: obs.map((ra) => ra.user.email),
    societyName: society.name,
    targetName,
    proposerName: session.user.name ?? session.user.email ?? "An Office Bearer",
    reviewUrl: `${base}/society/${societyId}/members`,
  });

  revalidatePath(`/society/${societyId}/members`);
}

export async function decideRemoveMember(
  societyId: string,
  proposedChangeId: string,
  decision: "APPROVED" | "REJECTED",
): Promise<{ error: string } | undefined> {
  await requireSocietyActionPermission(societyId, PERMISSIONS.APPROVE_MEMBER_REMOVAL);
  const session = await auth();
  if (!session) return { error: "Not authorized." };

  const change = await prisma.proposedChange.findUnique({ where: { id: proposedChangeId } });
  if (!change || change.societyId !== societyId || change.status !== "PENDING" || change.field !== "remove_member") {
    return { error: "This proposal is no longer pending." };
  }
  if (change.proposedByUserId === session.user.id) {
    return { error: "You can't approve your own proposal — it needs a different Office Bearer." };
  }

  const roleAssignmentId = change.oldValue;
  const target =
    decision === "APPROVED"
      ? await prisma.roleAssignment.findUnique({ where: { id: roleAssignmentId }, include: { user: true } })
      : null;
  if (decision === "APPROVED" && !target) {
    return { error: "This member no longer exists." };
  }

  await prisma.$transaction([
    prisma.proposedChange.update({
      where: { id: proposedChangeId },
      data: { status: decision, approvedByUserId: session.user.id, decidedAt: new Date() },
    }),
    ...(decision === "APPROVED" ? [prisma.roleAssignment.delete({ where: { id: roleAssignmentId } })] : []),
  ]);

  const proposer = await prisma.user.findUniqueOrThrow({ where: { id: change.proposedByUserId } });
  const society = await prisma.society.findUniqueOrThrow({ where: { id: societyId } });
  await notifyMemberRemovalDecided({
    proposerEmail: proposer.email,
    societyName: society.name,
    targetName: change.newValue,
    approved: decision === "APPROVED",
    deciderName: session.user.name ?? session.user.email ?? "an Office Bearer",
  });

  if (decision === "APPROVED" && target) {
    await notifyMemberRemoved({ email: target.user.email, societyName: society.name });
  }

  revalidatePath(`/society/${societyId}/members`);
}
