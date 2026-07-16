"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeTone } from "@/components/ui/badge";
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
  const router = useRouter();
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
    // castQuotationVote revalidates the server cache but this component is
    // already mounted — without a refresh, a vote that finalizes the
    // requirement (2nd approval) or returns it to the Manager (2nd
    // rejection) leaves the page showing stale data: the Work Order card
    // never appears, the vote list never shows the deciding vote.
    else router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3 border-status-warning-border bg-status-warning-bg">
      <h2 className="text-[18px] font-semibold text-text-primary">Office Bearer approval</h2>
      <p className="text-[13px] text-text-secondary">
        {approvals} of {votes.length} approved · {rejections} rejected — 2 approvals finalizes, 2 rejections
        sends it back to the Manager.
      </p>

      <div className="flex flex-col gap-2">
        {votes.map((v) => {
          const tone: BadgeTone =
            v.decision === "APPROVED" ? "success" : v.decision === "REJECTED" ? "error" : "neutral";
          const label = v.decision === "APPROVED" ? "Approved" : v.decision === "REJECTED" ? "Rejected" : "Awaiting vote";
          return (
            <div key={v.role} className="flex items-center justify-between rounded-lg bg-background-primary px-3 py-2 shadow-xs">
              <p className="text-[13px] font-medium text-text-primary">
                {v.role} ({v.name})
              </p>
              <Badge tone={tone}>{label}</Badge>
            </div>
          );
        })}
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
