"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { approveSociety, rejectSociety } from "./actions";

export function ApproveRejectPanel({ societyId, status }: { societyId: string; status: string }) {
  const [busy, setBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [rejected, setRejected] = useState(false);

  if (rejected) {
    return (
      <Card>
        <p className="text-[15px] text-text-primary">Rejected.</p>
      </Card>
    );
  }

  if (status !== "PENDING_VERIFICATION") {
    return (
      <Card>
        <p className="text-[15px] text-text-primary">
          Already {status.toLowerCase().replace("_", " ")} — no action needed.
        </p>
      </Card>
    );
  }

  if (inviteUrl) {
    return (
      <Card className="flex flex-col gap-2">
        <p className="text-[15px] font-medium text-text-primary">Approved.</p>
        <p className="text-[13px] text-text-secondary">
          Send this activation link to the Secretary (email delivery isn&apos;t wired up yet):
        </p>
        <p className="break-all rounded-md bg-background-secondary p-2 text-[13px] text-text-primary">
          {inviteUrl}
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      {!showReject ? (
        <div className="flex gap-3">
          <Button
            type="button"
            className="flex-1"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const result = await approveSociety(societyId);
              setInviteUrl(result.inviteUrl);
              setBusy(false);
            }}
          >
            Approve
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            disabled={busy}
            onClick={() => setShowReject(true)}
          >
            Reject
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <Input
              placeholder="Reason (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <p className="mt-1 text-[13px] text-text-secondary">
              This reason will be emailed to the applicant — keep it factual and professional.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await rejectSociety(societyId, rejectReason);
                setBusy(false);
                setRejected(true);
              }}
            >
              Confirm reject
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowReject(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
