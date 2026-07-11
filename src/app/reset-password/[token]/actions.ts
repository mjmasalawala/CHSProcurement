"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ error: string } | undefined> {
  if (newPassword.length < 8) return { error: "Password must be at least 8 characters." };

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return { error: "This reset link is invalid or has expired." };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);
}
