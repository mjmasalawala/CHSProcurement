"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { setInvitePassword, submitInviteProfile } from "./actions";

export function InviteOnboardingWizard({
  token,
  hasPassword,
  defaultName,
}: {
  token: string;
  hasPassword: boolean;
  defaultName: string;
}) {
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState("");
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await setInvitePassword(token, password);
    setSubmitting(false);
    if ("error" in result) setError(result.error);
    else setStep(2);
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await submitInviteProfile(token, name, phone, password);
    setSubmitting(false);
    if (result?.error) setError(result.error);
    // On success the action redirects (throws internally) — no try/catch
    // here, since catching would swallow that redirect.
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] font-medium text-text-secondary">Step {step} of 2</p>

      {error && <p className="text-[13px] text-status-error">{error}</p>}

      {step === 1 && (
        <form onSubmit={handleStep1} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="password">{hasPassword ? "Confirm your password" : "Set a password"}</Label>
            <Input
              id="password"
              type="password"
              minLength={hasPassword ? undefined : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Checking…" : "Continue"}
          </Button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleStep2} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Finishing…" : "Finish"}
          </Button>
        </form>
      )}
    </div>
  );
}
