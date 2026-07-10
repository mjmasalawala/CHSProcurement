"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { approveVendor, rejectVendor } from "./actions";

export function ApproveRejectPanel({
  vendorCompanyId,
  status,
}: {
  vendorCompanyId: string;
  status: string;
}) {
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  if (approved) {
    return (
      <Card>
        <p className="text-[15px] text-text-primary">Approved.</p>
      </Card>
    );
  }

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
              await approveVendor(vendorCompanyId);
              setBusy(false);
              setApproved(true);
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
                await rejectVendor(vendorCompanyId, rejectReason);
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
