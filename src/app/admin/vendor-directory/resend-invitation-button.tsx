"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { resendVendorInvitation } from "./actions";

const RESEND_COOLDOWN_SECONDS = 60;

export function ResendInvitationButton({ vendorSuggestionId }: { vendorSuggestionId: string }) {
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="secondary"
        className="border-accent-primary px-2.5 py-1 text-[12px] text-accent-primary hover:bg-accent-subtle"
        disabled={pending || cooldown > 0}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await resendVendorInvitation(vendorSuggestionId);
          setPending(false);
          if (result?.error) setError(result.error);
          else setCooldown(RESEND_COOLDOWN_SECONDS);
        }}
      >
        {pending ? "Sending…" : cooldown > 0 ? `Sent (${cooldown}s)` : "Resend Invitation"}
      </Button>
      {error && <p className="text-[12px] text-status-error">{error}</p>}
    </div>
  );
}
