import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { RoleName, type EntityType } from "@/generated/prisma/enums";
import { PERMISSIONS } from "@/lib/permissions";

export const IMPERSONATION_COOKIE = "impersonation_token";

// Hard cap on an impersonation session's lifetime, independent of the admin
// explicitly clicking "End" — see ImpersonationEvent.expiresAt.
const IMPERSONATION_TTL_MS = 30 * 60 * 1000;

// Roles that must never be impersonated, even by another SUPER_ADMIN —
// impersonation is for troubleshooting a regular user's account, not a
// privilege-escalation path into another admin's.
const PROTECTED_ROLES: RoleName[] = [RoleName.SUPER_ADMIN, RoleName.SUPPORT];

export function isProtectedFromImpersonation(
  roleAssignments: { role: RoleName; permissions: string[] }[],
): boolean {
  return roleAssignments.some(
    (ra) => PROTECTED_ROLES.includes(ra.role) || ra.permissions.includes(PERMISSIONS.IMPERSONATE_USER),
  );
}

/**
 * Re-validates a submitted user id server-side — the dropdown already
 * excludes protected users, but the form data is client-controlled, so this
 * is what's actually authoritative before an ImpersonationEvent is created.
 */
export async function resolveImpersonationTarget(
  userId: string,
): Promise<{ error: string } | { userId: string }> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { roleAssignments: { where: { status: "ACTIVE" } } },
  });
  if (!target) return { error: "User not found." };
  if (isProtectedFromImpersonation(target.roleAssignments)) {
    return { error: "This user can't be impersonated." };
  }

  return { userId: target.id };
}

/**
 * Creates the audit row and returns the opaque cookie token — the caller
 * (a server action, which has cookie-write access) sets it on the response.
 */
export async function createImpersonationEvent(
  adminUserId: string,
  targetUserId: string,
  reason: string,
): Promise<string> {
  const token = randomUUID();
  await prisma.impersonationEvent.create({
    data: {
      token,
      adminUserId,
      targetUserId,
      reason,
      expiresAt: new Date(Date.now() + IMPERSONATION_TTL_MS),
    },
  });
  return token;
}

/**
 * Resolves a cookie token to a still-live ImpersonationEvent (not expired,
 * not ended) plus the target user's session-shaped data. Called from
 * auth.ts's session callback on every session read, so it stays a single
 * indexed lookup — no joins beyond the one roleAssignments include.
 */
export async function loadActiveImpersonation(token: string): Promise<{
  id: string;
  reason: string;
  startedAt: Date;
  adminUserId: string;
  adminUser: { name: string | null; email: string };
  targetUser: {
    id: string;
    email: string;
    name: string | null;
    roleAssignments: {
      id: string;
      entityType: EntityType;
      entityId: string | null;
      role: RoleName;
      permissions: string[];
    }[];
  };
} | null> {
  const event = await prisma.impersonationEvent.findUnique({
    where: { token },
    include: {
      adminUser: true,
      targetUser: { include: { roleAssignments: { where: { status: "ACTIVE" } } } },
    },
  });
  if (!event || event.endedAt || event.expiresAt < new Date()) return null;
  return event;
}

export async function endImpersonationEvent(token: string): Promise<void> {
  await prisma.impersonationEvent.updateMany({
    where: { token, endedAt: null },
    data: { endedAt: new Date() },
  });
}
