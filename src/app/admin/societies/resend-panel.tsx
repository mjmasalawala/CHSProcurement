"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { resendSocietyActivationEmail } from "./actions";

interface Props {
  societies: { id: string; name: string }[];
}

/**
 * Quick lookup-by-name so an admin doesn't need to already know which
 * society/member row to open — only approved (ACTIVE) societies are
 * offered, since a still-pending or rejected one never had an activation
 * email to lose in the first place.
 */
export function ResendActivationPanel({ societies }: Props) {
  const [societyId, setSocietyId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleResend() {
    if (!societyId) return;
    setSending(true);
    setError(null);
    setSent(false);
    const result = await resendSocietyActivationEmail(societyId);
    setSending(false);
    if (result?.error) setError(result.error);
    else setSent(true);
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="text-[15px] font-semibold text-text-primary">Resend activation email</p>
        <p className="text-[13px] text-text-secondary">
          Lost the original email? Find the society by name and resend its account manager&apos;s activation link.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <SearchableSelect
          className="sm:max-w-sm sm:flex-1"
          options={societies.map((s) => ({ id: s.id, label: s.name }))}
          value={societyId}
          onChange={(id) => {
            setSocietyId(id);
            setError(null);
            setSent(false);
          }}
          placeholder="Search societies…"
        />
        <Button type="button" disabled={!societyId || sending} onClick={handleResend}>
          {sending ? "Sending…" : "Resend"}
        </Button>
      </div>
      {sent && <p className="text-[13px] text-status-success">Activation email resent.</p>}
      {error && <p className="text-[13px] text-status-error">{error}</p>}
    </Card>
  );
}
