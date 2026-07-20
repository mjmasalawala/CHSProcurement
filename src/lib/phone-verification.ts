import { prisma } from "@/lib/prisma";
// OTP now goes over WhatsApp, not SMS — DLT entity/template registration for
// SMS costs ~₹5000+GST and isn't happening right now, while WhatsApp
// template approval is free and handled directly by Meta (product decision,
// 2026-07-19). See lib/whatsapp.ts for the send + its own console-log
// fallback until a Meta Business Platform number/template is configured.
import { sendWhatsappOtp } from "@/lib/whatsapp";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Creates a fresh OTP row and sends it over WhatsApp (lib/whatsapp.ts) — a
 * new row on every call rather than updating one in place, so requesting a
 * new code invalidates any earlier one instead of leaving it replayable.
 */
export async function sendPhoneVerificationCode(userId: string, phone: string): Promise<void> {
  const code = generateCode();
  await prisma.phoneVerification.create({
    data: { userId, phone, code, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  await sendWhatsappOtp({ to: phone, code });
}

/**
 * Checks the code against the most recently issued OTP for this user. On
 * success, stamps User.phone/phoneVerifiedAt and clears every outstanding
 * verification row for the user (there's only ever meant to be one valid
 * one, but this also mops up any expired leftovers from earlier attempts).
 */
export async function verifyPhoneVerificationCode(
  userId: string,
  code: string,
): Promise<{ error: string } | { phone: string }> {
  const verification = await prisma.phoneVerification.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!verification) return { error: "No verification code found — request a new one." };
  if (verification.expiresAt < new Date()) return { error: "This code has expired — request a new one." };
  if (verification.code !== code.trim()) return { error: "Incorrect code." };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { phone: verification.phone, phoneVerifiedAt: new Date() },
    }),
    prisma.phoneVerification.deleteMany({ where: { userId } }),
  ]);

  return { phone: verification.phone };
}
