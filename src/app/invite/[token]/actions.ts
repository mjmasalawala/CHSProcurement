"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

async function loadInvite(token: string) {
  return prisma.invite.findUnique({
    where: { token },
    include: { roleAssignment: { include: { user: true } } },
  });
}

async function markAccepted(inviteId: string, roleAssignmentId: string) {
  await prisma.$transaction([
    prisma.invite.update({ where: { id: inviteId }, data: { acceptedAt: new Date() } }),
    prisma.roleAssignment.update({
      where: { id: roleAssignmentId },
      data: { status: "ACTIVE" },
    }),
  ]);
}

/** Brand-new user: sets a password, then signs in with the now-active role. */
export async function acceptInviteNewUser(token: string, formData: FormData) {
  const invite = await loadInvite(token);
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    redirect(`/invite/${token}?error=invalid`);
  }

  const password = formData.get("password");
  if (typeof password !== "string" || password.length < 8) {
    redirect(`/invite/${token}?error=weak_password`);
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: invite.roleAssignment.userId },
    data: { passwordHash },
  });
  await markAccepted(invite.id, invite.roleAssignmentId);

  try {
    await signIn("credentials", {
      email: invite.email,
      password,
      redirectTo: "/app",
    });
  } catch (err) {
    if (err instanceof AuthError) redirect("/login");
    throw err;
  }
}

/** Existing account: verify their password, then re-establish a fresh session. */
export async function acceptInviteExistingUser(token: string, formData: FormData) {
  const invite = await loadInvite(token);
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    redirect(`/invite/${token}?error=invalid`);
  }

  const password = formData.get("password");
  const hash = invite.roleAssignment.user.passwordHash;
  if (typeof password !== "string" || !hash || !(await verifyPassword(password, hash))) {
    redirect(`/invite/${token}?error=invalid_password`);
  }

  await markAccepted(invite.id, invite.roleAssignmentId);

  try {
    await signIn("credentials", {
      email: invite.email,
      password,
      redirectTo: "/app",
    });
  } catch (err) {
    if (err instanceof AuthError) redirect("/login");
    throw err;
  }
}

/**
 * Already signed in as the invitee (e.g. a Manager who runs several
 * societies accepting a new one) — landing-page-and-auth-flow-spec.md
 * Section 4 edge case. The current session's JWT was minted before this
 * role existed, so we sign out and ask them to log back in rather than
 * building live session refresh for v1 — see src/auth.ts jwt callback note.
 */
export async function acceptInviteForCurrentSession(token: string) {
  const invite = await loadInvite(token);
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    redirect(`/invite/${token}?error=invalid`);
  }

  await markAccepted(invite.id, invite.roleAssignmentId);
  await signOut({ redirectTo: "/login?accepted=1" });
}
