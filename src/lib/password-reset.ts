import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/base-url";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour — shorter than Invite's 24 hours since this grants immediate account access.

export async function createPasswordResetToken(userId: string): Promise<{ token: string; url: string }> {
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: { token, userId, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  });

  const base = getBaseUrl();
  return { token, url: `${base}/reset-password/${token}` };
}
