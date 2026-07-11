"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "./actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await resetPassword(token, password);
    setSubmitting(false);
    if (result?.error) setError(result.error);
    else {
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    }
  }

  if (done) {
    return (
      <p className="text-[15px] text-text-primary">
        Password updated. Redirecting you to login…
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="mt-1 text-[13px] text-text-secondary">At least 8 characters.</p>
      </div>
      {error && <p className="text-[13px] text-status-error">{error}</p>}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
