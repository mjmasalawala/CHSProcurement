"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { resendSocietyMemberInvite } from "./actions";

const RESEND_COOLDOWN_SECONDS = 60;

export function ResendInviteButton({
  societyId,
  roleAssignmentId,
}: {
  societyId: string;
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
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="secondary"
        className="px-2.5 py-1 text-[12px]"
        disabled={pending || cooldown > 0}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await resendSocietyMemberInvite(societyId, roleAssignmentId);
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
