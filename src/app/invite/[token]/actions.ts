"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { sendPhoneVerificationCode, verifyPhoneVerificationCode } from "@/lib/phone-verification";

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
// /app router, with a nudge to invite the rest of the committee — most
// pressing right after society registration, when only one person (often
// not the Secretary) has an account so far.
function postAcceptRedirectPath(roleAssignment: { entityType: string; entityId: string | null }): string {
  if (roleAssignment.entityType === "SOCIETY" && roleAssignment.entityId) {
    return `/society/${roleAssignment.entityId}/members?nudge=invite`;
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
 * New-user (or not-yet-phone-verified) invite acceptance, step 1 of 3
 * (society-portal-spec.md / vendor-registration-portal-spec.md — invited
 * users provide a name and OTP-verified phone number, not just a
 * password). markAccepted/sign-in doesn't happen until step 3
 * (verifyInvitePhoneCode) succeeds, so an invite isn't "used up" by a user
 * who abandons partway through.
 *
 * Handles two cases with the same action: if no password is set yet, this
 * sets one; if a password already exists (the user set it in step 1 on a
 * previous visit, then refreshed/left before finishing steps 2-3), this
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
 * Step 2: name + phone. Saves the name immediately (low-stakes), but the
 * phone isn't written to User until the OTP in step 3 confirms it's real —
 * see phone-verification.ts.
 */
export async function submitInviteProfile(
  token: string,
  name: string,
  phone: string,
): Promise<{ error: string } | { ok: true }> {
  const invite = await loadInvite(token);
  requireOpenInvite(invite, token);
  if (!invite) return { error: "This invite link is invalid or has already been used." };

  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  if (!trimmedName) return { error: "Name is required." };
  if (!trimmedPhone) return { error: "Phone number is required." };

  await prisma.user.update({
    where: { id: invite.roleAssignment.userId },
    data: { name: trimmedName },
  });

  try {
    await sendPhoneVerificationCode(invite.roleAssignment.userId, trimmedPhone);
  } catch (err) {
    // Unlike a post-completion notification, OTP delivery IS the action here
    // — a WhatsApp send failure means the user genuinely has no code to
    // enter, so this must surface as an error rather than silently letting
    // them proceed to a step 3 they can't complete.
    console.error("Failed to send invite phone verification code:", err);
    return { error: "Couldn't send your verification code. Please try again." };
  }

  return { ok: true };
}

/** Re-sends a fresh OTP to the phone number submitted in step 2. */
export async function resendInvitePhoneCode(token: string): Promise<{ error: string } | { ok: true }> {
  const invite = await loadInvite(token);
  requireOpenInvite(invite, token);
  if (!invite) return { error: "This invite link is invalid or has already been used." };

  const lastAttempt = await prisma.phoneVerification.findFirst({
    where: { userId: invite.roleAssignment.userId },
    orderBy: { createdAt: "desc" },
  });
  if (!lastAttempt) return { error: "Enter your phone number again first." };

  try {
    await sendPhoneVerificationCode(invite.roleAssignment.userId, lastAttempt.phone);
  } catch (err) {
    console.error("Failed to resend invite phone verification code:", err);
    return { error: "Couldn't send your verification code. Please try again." };
  }
  return { ok: true };
}

/** Step 3: OTP confirms the phone, then the invite is finally accepted and the user signed in. */
export async function verifyInvitePhoneCode(
  token: string,
  code: string,
  password: string,
): Promise<{ error: string } | undefined> {
  const invite = await loadInvite(token);
  requireOpenInvite(invite, token);
  if (!invite) return { error: "This invite link is invalid or has already been used." };

  const result = await verifyPhoneVerificationCode(invite.roleAssignment.userId, code);
  if ("error" in result) return result;

  await markAccepted(invite.id, invite.roleAssignmentId);
  await signInAndRedirect(invite.email, password, postAcceptRedirectPath(invite.roleAssignment));
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
  await signInAndRedirect(invite.email, password, postAcceptRedirectPath(invite.roleAssignment));
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
