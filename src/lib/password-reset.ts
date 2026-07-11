import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour — shorter than Invite's 7 days since this grants immediate account access.

export async function createPasswordResetToken(userId: string): Promise<{ token: string; url: string }> {
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: { token, userId, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  });

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return { token, url: `${base}/reset-password/${token}` };
}
