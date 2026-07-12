import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { ResetPasswordForm } from "./form";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
  const invalid = !resetToken || !!resetToken.usedAt || resetToken.expiresAt < new Date();

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-[28px] font-bold tracking-tight text-text-primary">Reset your password</h1>

        {invalid ? (
          <>
            <p className="mt-4 text-[15px] text-text-primary">
              This reset link is invalid or has expired.
            </p>
            <a href="/forgot-password" className="mt-2 inline-block text-[13px] text-accent-primary underline">
              Request a new one
            </a>
          </>
        ) : (
          <div className="mt-4">
            <ResetPasswordForm token={token} />
          </div>
        )}
      </Card>
    </main>
  );
}
