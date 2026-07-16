"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  setInvitePassword,
  submitInviteProfile,
  resendInvitePhoneCode,
  verifyInvitePhoneCode,
} from "./actions";

const RESEND_COOLDOWN_SECONDS = 30;

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
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

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
    const result = await submitInviteProfile(token, name, phone);
    setSubmitting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setStep(3);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    startCooldownTimer();
  }

  function startCooldownTimer() {
    const timer = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function handleResend() {
    setSubmitting(true);
    setError(null);
    const result = await resendInvitePhoneCode(token);
    setSubmitting(false);
    if ("error" in result) setError(result.error);
    else {
      setCooldown(RESEND_COOLDOWN_SECONDS);
      startCooldownTimer();
    }
  }

  async function handleStep3(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await verifyInvitePhoneCode(token, code, password);
    setSubmitting(false);
    if (result?.error) setError(result.error);
    // On success the action redirects — nothing left to do here.
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] font-medium text-text-secondary">Step {step} of 3</p>

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
            {submitting ? "Sending code…" : "Send verification code"}
          </Button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleStep3} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="code">Verification code</Label>
            <p className="mb-1.5 text-[13px] text-text-secondary">
              We sent a 6-digit code to {phone}. SMS delivery isn&apos;t connected yet — check the server
              logs for the code.
            </p>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Verifying…" : "Verify & finish"}
          </Button>
          <button
            type="button"
            disabled={submitting || cooldown > 0}
            onClick={handleResend}
            className="text-[13px] font-medium text-accent-primary underline disabled:cursor-not-allowed disabled:text-text-tertiary disabled:no-underline"
          >
            {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
          </button>
        </form>
      )}
    </div>
  );
}
