"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resendVendorSuggestion } from "./actions";

const RESEND_COOLDOWN_SECONDS = 60;

export function ResendInviteButton({
  societyId,
  vendorSuggestionId,
  fullWidth,
}: {
  societyId: string;
  vendorSuggestionId: string;
  fullWidth?: boolean;
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
    <div className={cn("flex flex-col gap-1", fullWidth ? "w-full items-stretch" : "items-start")}>
      <Button
        type="button"
        variant="secondary"
        className={cn(
          "border-accent-primary px-2.5 py-1 text-[12px] text-accent-primary hover:bg-accent-subtle",
          fullWidth && "w-full",
        )}
        disabled={pending || cooldown > 0}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await resendVendorSuggestion(societyId, vendorSuggestionId);
          setPending(false);
          if (result?.error) setError(result.error);
          else setCooldown(RESEND_COOLDOWN_SECONDS);
        }}
      >
        {pending ? "Sending…" : cooldown > 0 ? `Sent (${cooldown}s)` : "Resend Invite"}
      </Button>
      {error && <p className="text-[12px] text-status-error">{error}</p>}
    </div>
  );
}
