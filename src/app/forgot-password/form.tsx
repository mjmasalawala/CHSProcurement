"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "./actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await requestPasswordReset(email);
    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="text-[15px] text-text-primary">
        If an account exists for <span className="font-medium">{email}</span>, we&apos;ve sent a link to
        reset your password. It expires in 1 hour.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
