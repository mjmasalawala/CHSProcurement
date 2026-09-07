"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { sendPhoneVerificationCode, verifyPhoneVerificationCode } from "@/lib/phone-verification";

// Only ever redirect within our own app — an absolute/external callbackUrl
// would be an open-redirect vector.
function safeCallbackUrl(formData: FormData): string {
  const value = formData.get("callbackUrl");
  return typeof value === "string" && value.startsWith("/") ? value : "/app";
}

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safeCallbackUrl(formData) });
}

/**
 * Step 1: checks the password directly (rather than going straight to
 * signIn) so a correct-password-but-unverified-phone account (register/
 * vendor, User.phoneVerificationRequired) gets routed into the OTP screen
 * instead of a bare "incorrect credentials" error — auth.ts's authorize()
 * still refuses the sign-in itself either way, this is just the friendlier
 * path to the same real gate.
 */
export async function attemptCredentialsLogin(
  email: string,
  password: string,
  callbackUrl: string,
): Promise<{ error: string } | { needsVerification: true } | undefined> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Incorrect email or password." };
  }

  if (user.phoneVerificationRequired && !user.phoneVerifiedAt) {
    // User.phone isn't stamped until verification actually succeeds, so the
    // number to resend to comes from the most recent PhoneVerification row
    // instead (always exists — the flow that set phoneVerificationRequired
    // true also always sent an initial code).
    const lastVerification = await prisma.phoneVerification.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    if (!lastVerification) {
      return { error: "We couldn't find a phone number to verify on this account. Contact support." };
    }
    try {
      await sendPhoneVerificationCode(user.id, lastVerification.phone);
    } catch (err) {
      console.error("attemptCredentialsLogin: failed to send verification code", err);
      return { error: "Couldn't send a verification code — try again in a moment." };
    }
    return { needsVerification: true };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
  } catch (err) {
    if (err instanceof AuthError) return { error: "Incorrect email or password." };
    throw err;
  }
}

/** Re-sends a fresh code during the login-time verification step. */
export async function resendLoginPhoneCode(email: string): Promise<{ error: string } | { ok: true }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: "Account not found." };

  const lastVerification = await prisma.phoneVerification.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!lastVerification) return { error: "We couldn't find a phone number to verify on this account. Contact support." };

  try {
    await sendPhoneVerificationCode(user.id, lastVerification.phone);
  } catch (err) {
    console.error("resendLoginPhoneCode: failed to send verification code", err);
    return { error: "Couldn't resend the code — try again in a moment." };
  }

  return { ok: true };
}

/** Step 2: confirms the code, then completes the sign-in the OTP screen deferred. */
export async function verifyLoginPhone(
  email: string,
  code: string,
  password: string,
  callbackUrl: string,
): Promise<{ error: string } | undefined> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: "Account not found." };

  const result = await verifyPhoneVerificationCode(user.id, code.trim());
  if ("error" in result) return result;

  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
  } catch (err) {
    if (err instanceof AuthError) redirect("/login?error=invalid_credentials");
    throw err;
  }
}
