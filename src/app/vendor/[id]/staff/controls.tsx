"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { inviteStaff, setStaffActive, resendStaffInvite } from "./actions";

export function InviteStaffForm({ vendorCompanyId }: { vendorCompanyId: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await inviteStaff(vendorCompanyId, email);
    setSubmitting(false);
    if (result?.error) setError(result.error);
    else setEmail("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex-1">
        <Input
          type="email"
          placeholder="staff@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {error && <p className="mt-1 text-[13px] text-status-error">{error}</p>}
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Inviting…" : "Invite staff"}
      </Button>
    </form>
  );
}

const RESEND_COOLDOWN_SECONDS = 60;

export function ResendStaffInviteButton({
  vendorCompanyId,
  roleAssignmentId,
}: {
  vendorCompanyId: string;
  roleAssignmentId: string;
}) {
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  return (
    // Fixed width regardless of whether `error` is showing — that's what
    // keeps the button from shifting left when the message appears. Normal
    // (non-absolute) flow so the row grows to fit a wrapped error instead of
    // the message hanging past the row's bottom border.
    <div className="flex w-44 flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        disabled={pending || cooldown > 0}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await resendStaffInvite(vendorCompanyId, roleAssignmentId);
          setPending(false);
          if (result?.error) setError(result.error);
          else setCooldown(RESEND_COOLDOWN_SECONDS);
        }}
      >
        {pending ? "Sending…" : cooldown > 0 ? `Sent (${cooldown}s)` : "Resend Invite"}
      </Button>
      {error && <p className="text-right text-[12px] text-status-error">{error}</p>}
    </div>
  );
}

export function ToggleStaffButton({
  vendorCompanyId,
  roleAssignmentId,
  active,
}: {
  vendorCompanyId: string;
  roleAssignmentId: string;
  active: boolean;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await setStaffActive(vendorCompanyId, roleAssignmentId, !active);
        setPending(false);
      }}
    >
      {active ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
