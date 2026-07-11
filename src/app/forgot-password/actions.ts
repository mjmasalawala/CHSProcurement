"use server";

import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendPasswordReset } from "@/lib/email";

/**
 * Always resolves the same way regardless of whether the email exists —
 * the caller shows one generic "check your email" message either way, so
 * this endpoint can't be used to enumerate registered accounts.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return;

  const user = await prisma.user.findUnique({ where: { email: trimmed } });
  if (!user) return;

  const { url } = await createPasswordResetToken(user.id);
  await sendPasswordReset({ email: trimmed, url });
}
