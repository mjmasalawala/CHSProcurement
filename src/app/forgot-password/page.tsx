import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ForgotPasswordForm } from "./form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-[24px] font-bold text-text-primary">Forgot your password?</h1>
        <p className="mb-6 text-[13px] text-text-secondary">
          Enter your email and we&apos;ll send you a link to reset it.
        </p>

        <ForgotPasswordForm />

        <Link href="/login" className="mt-4 inline-block text-[13px] text-accent-primary underline">
          Back to login
        </Link>
      </Card>
    </main>
  );
}
