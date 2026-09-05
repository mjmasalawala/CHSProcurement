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

function requireOpenInvite(invite: Awaited<ReturnType<typeof loadInvite>>, token: string) {
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    redirect(`/invite/${token}?error=invalid`);
  }
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

// First login into a Society role lands on Members instead of the generic
// /app router, with a nudge to invite the rest of the committee — but only
// when this genuinely is the first active member (this invitee's own
// RoleAssignment is already flipped ACTIVE by markAccepted before this
// runs, so "only me" means the count is 1). Without this check, every
// invite acceptance — even a Manager invited by an existing Secretary into
// an already-set-up society — saw "Only you have access so far", which is
// simply false (bug found + fixed 2026-09-05).
async function postAcceptRedirectPath(roleAssignment: { entityType: string; entityId: string | null }): Promise<string> {
  if (roleAssignment.entityType === "SOCIETY" && roleAssignment.entityId) {
    const activeMemberCount = await prisma.roleAssignment.count({
      where: { entityType: "SOCIETY", entityId: roleAssignment.entityId, status: "ACTIVE" },
    });
    if (activeMemberCount <= 1) {
      return `/society/${roleAssignment.entityId}/members?nudge=invite`;
    }
  }
  return "/app";
}

async function signInAndRedirect(email: string, password: string, redirectTo: string) {
  try {
    await signIn("credentials", { email, password, redirectTo });
  } catch (err) {
    if (err instanceof AuthError) redirect("/login");
    throw err;
  }
}

/**
 * New-user (or not-yet-onboarded) invite acceptance, step 1 of 2. Phone OTP
 * verification (originally step 2 of 3) is skipped for now — no WhatsApp
 * Business number/template is configured yet (see lib/whatsapp.ts), so
 * there's no way to actually deliver a code. lib/phone-verification.ts and
 * the PhoneVerification model are left in place, unused, to reconnect once
 * a real send path exists; submitInviteProfile below saves the phone number
 * as given and completes the invite immediately instead.
 *
 * Handles two cases with the same action: if no password is set yet, this
 * sets one; if a password already exists (the user set it in step 1 on a
 * previous visit, then refreshed/left before finishing step 2), this
 * verifies it instead of silently overwriting — a mismatched resubmission
 * is rejected rather than quietly resetting their credential.
 */
export async function setInvitePassword(
  token: string,
  password: string,
): Promise<{ error: string } | { ok: true }> {
  const invite = await loadInvite(token);
  requireOpenInvite(invite, token);
  if (!invite) return { error: "This invite link is invalid or has already been used." };

  const existingHash = invite.roleAssignment.user.passwordHash;
  if (existingHash) {
    if (!(await verifyPassword(password, existingHash))) {
      return { error: "Incorrect password." };
    }
    return { ok: true };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: invite.roleAssignment.userId },
    data: { passwordHash },
  });

  return { ok: true };
}

/**
 * Step 2 (final): name + phone. Saves both directly and completes the
 * invite — no OTP round-trip (see the note above setInvitePassword).
 * phoneVerifiedAt is still stamped, unverified, so this remains a one-time
 * onboarding step rather than something every future invite re-asks (see
 * needsOnboarding in page.tsx); it stops meaning "OTP-confirmed" until a
 * real send path replaces this.
 */
export async function submitInviteProfile(
  token: string,
  name: string,
  phone: string,
  password: string,
): Promise<{ error: string } | undefined> {
  const invite = await loadInvite(token);
  requireOpenInvite(invite, token);
  if (!invite) return { error: "This invite link is invalid or has already been used." };

  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  if (!trimmedName) return { error: "Name is required." };
  if (!trimmedPhone) return { error: "Phone number is required." };

  await prisma.user.update({
    where: { id: invite.roleAssignment.userId },
    data: { name: trimmedName, phone: trimmedPhone, phoneVerifiedAt: new Date() },
  });

  await markAccepted(invite.id, invite.roleAssignmentId);
  await signInAndRedirect(invite.email, password, await postAcceptRedirectPath(invite.roleAssignment));
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
  await signInAndRedirect(invite.email, password, await postAcceptRedirectPath(invite.roleAssignment));
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
