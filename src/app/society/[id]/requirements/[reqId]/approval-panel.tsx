"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { castQuotationVote } from "./actions";

interface Vote {
  role: string;
  name: string;
  decision: "APPROVED" | "REJECTED" | null;
}

interface Props {
  societyId: string;
  requirementId: string;
  votes: Vote[];
  canVote: boolean;
}

export function ApprovalPanel({ societyId, requirementId, votes, canVote }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approvals = votes.filter((v) => v.decision === "APPROVED").length;
  const rejections = votes.filter((v) => v.decision === "REJECTED").length;

  async function vote(decision: "APPROVED" | "REJECTED") {
    setSubmitting(true);
    setError(null);
    const result = await castQuotationVote(societyId, requirementId, decision);
    setSubmitting(false);
    if (result?.error) setError(result.error);
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-[18px] font-semibold text-text-primary">Office Bearer approval</h2>
      <p className="text-[13px] text-text-secondary">
        {approvals} of {votes.length} approved · {rejections} rejected — 2 approvals finalizes, 2 rejections
        sends it back to the Manager.
      </p>

      <div className="flex flex-col gap-1">
        {votes.map((v) => (
          <p key={v.role} className="text-[13px] text-text-primary">
            <span className="font-medium">
              {v.role} ({v.name})
            </span>{" "}
            —{" "}
            {v.decision === "APPROVED"
              ? "Approved"
              : v.decision === "REJECTED"
                ? "Rejected"
                : "Awaiting vote"}
          </p>
        ))}
      </div>

      {error && <p className="text-[13px] text-status-error">{error}</p>}

      {canVote && (
        <div className="flex gap-3">
          <Button type="button" disabled={submitting} onClick={() => vote("APPROVED")}>
            Approve
          </Button>
          <Button type="button" variant="secondary" disabled={submitting} onClick={() => vote("REJECTED")}>
            Reject
          </Button>
        </div>
      )}
    </Card>
  );
}
