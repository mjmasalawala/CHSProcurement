"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Shown once, right after a first-time society login lands here via
// ?nudge=invite (see invite/[token]/actions.ts postAcceptRedirectPath) — a
// banner was too easy to skim past, so this blocks the page until dismissed.
export function InviteNudgeModal({ societyId }: { societyId: string }) {
  const router = useRouter();

  function dismiss() {
    router.replace(`/society/${societyId}/members`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <Card className="w-full max-w-sm text-center">
        <p className="text-[17px] font-semibold text-text-primary">Congrats! You&apos;re in! Next step - </p>
        <p className="mt-2 text-[14px] text-text-secondary">
          Only you have access so far. Invite your Manager and Office Bearers to get
          them set up.
        </p>
        <Button className="mt-4 w-full" onClick={dismiss}>
          Got it
        </Button>
      </Card>
    </div>
  );
}
