import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Creates a fresh OTP row and "sends" it via sendSms — a placeholder until a
 * real SMS provider is wired up (see lib/sms.ts), so today this just logs
 * `[sms:stub] ...` to the server console. A new row on every call rather
 * than updating one in place, so requesting a new code invalidates any
 * earlier one instead of leaving it replayable.
 */
export async function sendPhoneVerificationCode(userId: string, phone: string): Promise<void> {
  const code = generateCode();
  await prisma.phoneVerification.create({
    data: { userId, phone, code, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  await sendSms({
    to: phone,
    body: `ProSoc: Your verification code is ${code}. It expires in 10 minutes.`,
  });
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
