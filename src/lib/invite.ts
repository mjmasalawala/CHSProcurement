import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { EntityType, RoleName } from "@/generated/prisma/enums";
import { ROLE_DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { getEntityName } from "@/lib/entities";
import { sendInvite, notifyAddedToExistingAccount } from "@/lib/notifications";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// User-facing text on an email send failure — the real cause (e.g. Resend
// domain-verification errors) is logged server-side via console.error, not
// shown to the invitee/inviter, since it's an infra detail they can't act on.
const EMAIL_FAILURE_MESSAGE = "Email sending failed. Please contact support.";

/**
 * Generic invite-acceptance mechanism (landing-page-and-auth-flow-spec.md
 * Section 4) — one function, parameterized by role/entity, reused for every
 * invite type (Secretary activation, Manager/Chairman/Treasurer invited by
 * Secretary, Vendor Staff invited by Owner).
 *
 * Two paths, branching on whether the email already belongs to a real
 * account (passwordHash set — i.e. someone who has actually logged in
 * before, not just a stub User row created by an earlier unaccepted
 * invite): a brand-new person gets the usual PENDING RoleAssignment + a
 * single-use token, flipped to ACTIVE by visiting /invite/[token] and
 * setting a password. Someone who already has working ProSoc credentials
 * doesn't need to go through that again — their RoleAssignment activates
 * immediately and they're just emailed a plain /login link (product
 * decision, 2026-07-13).
 *
 * The invite record itself (RoleAssignment [+ Invite row, new-user path
 * only]) is the source of truth — a send failure (bad domain config,
 * provider outage, etc.) doesn't roll that back, since the record is still
 * useful (the URL can be shared manually, or resendInvite tried again
 * later). emailError is set instead of throwing, so a broken mail provider
 * can't take down invite creation itself.
 */
export async function createInvite(params: {
  email: string;
  entityType: EntityType;
  entityId: string | null;
  role: RoleName;
}): Promise<{ token: string | null; url: string; emailError?: string }> {
  const existingUser = await prisma.user.findUnique({ where: { email: params.email } });
  const hasRealAccount = !!existingUser?.passwordHash;

  const user =
    existingUser ??
    (await prisma.user.create({
      data: { email: params.email },
    }));

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const entityName = await getEntityName(params.entityType, params.entityId);

  if (hasRealAccount) {
    await prisma.roleAssignment.create({
      data: {
        userId: user.id,
        entityType: params.entityType,
        entityId: params.entityId,
        role: params.role,
        permissions: ROLE_DEFAULT_PERMISSIONS[params.role],
        status: "ACTIVE",
      },
    });

    const loginUrl = `${base}/login`;
    try {
      await notifyAddedToExistingAccount({ email: params.email, role: params.role, entityName, loginUrl });
    } catch (err) {
      console.error("createInvite: failed to send added-to-existing-account email", err);
      return { token: null, url: loginUrl, emailError: EMAIL_FAILURE_MESSAGE };
    }
    return { token: null, url: loginUrl };
  }

  const roleAssignment = await prisma.roleAssignment.create({
    data: {
      userId: user.id,
      entityType: params.entityType,
      entityId: params.entityId,
      role: params.role,
      permissions: ROLE_DEFAULT_PERMISSIONS[params.role],
      status: "PENDING",
    },
  });

  const token = randomBytes(32).toString("base64url");
  await prisma.invite.create({
    data: {
      token,
      email: params.email,
      roleAssignmentId: roleAssignment.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const url = `${base}/invite/${token}`;
  try {
    await sendInvite({ email: params.email, role: params.role, entityName, url });
  } catch (err) {
    console.error("createInvite: failed to send invite email", err);
    return { token, url, emailError: EMAIL_FAILURE_MESSAGE };
  }

  return { token, url };
}

/**
 * Re-triggers the invite email for a still-PENDING RoleAssignment — e.g. the
 * first email got lost/spam-filtered/never arrived. Reuses the existing
 * Invite row (roleAssignmentId is @unique, so there's only ever one) with a
 * fresh token and a renewed 7-day expiry; the old token stops resolving the
 * moment this runs, so there's never more than one valid link outstanding.
 */
export async function resendInvite(roleAssignmentId: string): Promise<{ error: string } | undefined> {
  const roleAssignment = await prisma.roleAssignment.findUnique({
    where: { id: roleAssignmentId },
    include: { user: true, invite: true },
  });
  if (!roleAssignment || roleAssignment.status !== "PENDING" || !roleAssignment.invite) {
    return { error: "No pending invite to resend." };
  }

  const token = randomBytes(32).toString("base64url");
  await prisma.invite.update({
    where: { id: roleAssignment.invite.id },
    data: { token, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const url = `${base}/invite/${token}`;
  const entityName = await getEntityName(roleAssignment.entityType, roleAssignment.entityId);
  try {
    await sendInvite({ email: roleAssignment.user.email, role: roleAssignment.role, entityName, url });
  } catch (err) {
    console.error("resendInvite: failed to send invite email", err);
    return { error: EMAIL_FAILURE_MESSAGE };
  }
}
