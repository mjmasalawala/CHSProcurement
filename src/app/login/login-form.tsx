"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { attemptCredentialsLogin, resendLoginPhoneCode, verifyLoginPhone } from "./actions";

/**
 * Two-step client component so a correct password on a not-yet-phone-
 * verified account (register/vendor, User.phoneVerificationRequired) can
 * detour into an OTP screen instead of a bare "incorrect credentials"
 * error — see attemptCredentialsLogin's doc comment. Most logins never see
 * step 2 at all; attemptCredentialsLogin signs them in directly.
 */
export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [step, setStep] = useState<"credentials" | "verify">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await attemptCredentialsLogin(email, password, callbackUrl);
    setSubmitting(false);
    if (!result) return; // success — the action already redirected
    if ("error" in result) setError(result.error);
    else setStep("verify");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await verifyLoginPhone(email, code, password, callbackUrl);
    setSubmitting(false);
    if (result?.error) setError(result.error);
    // On success the action redirects (throws internally) — no further handling here.
  }

  async function handleResend() {
    setError(null);
    setResent(false);
    const result = await resendLoginPhoneCode(email);
    if ("error" in result) setError(result.error);
    else setResent(true);
  }

  if (step === "verify") {
    return (
      <form onSubmit={handleVerify} className="flex flex-col gap-4">
        <p className="text-[13px] text-text-secondary">
          Your phone hasn&apos;t been verified yet — we sent a 6-digit code to it on WhatsApp. Enter it below to finish logging in.
        </p>
        <div>
          <Label htmlFor="code">Verification code</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-[13px] text-status-error">{error}</p>}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Verifying…" : "Verify & log in"}
        </Button>
        <button
          type="button"
          onClick={handleResend}
          className="text-[13px] font-medium text-accent-primary underline hover:no-underline"
        >
          Resend code
        </button>
        {resent && <p className="text-[13px] text-status-success">Code resent.</p>}
      </form>
    );
  }

  return (
    <form onSubmit={handleCredentials} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-[13px] text-status-error">{error}</p>}
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
