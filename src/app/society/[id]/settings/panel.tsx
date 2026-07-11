"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { proposeThresholdChange, decideThresholdChange } from "./actions";

export function ProposeThresholdForm({ societyId }: { societyId: string }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await proposeThresholdChange(societyId, value);
    setSubmitting(false);
    if (result?.error) setError(result.error);
    else setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex-1">
        <Label htmlFor="newThreshold">Propose new threshold (₹)</Label>
        <Input
          id="newThreshold"
          type="number"
          min={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
        {error && <p className="mt-1 text-[13px] text-status-error">{error}</p>}
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Proposing…" : "Propose"}
      </Button>
    </form>
  );
}

export function DecideThresholdPanel({
  societyId,
  proposedChangeId,
}: {
  societyId: string;
  proposedChangeId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function decide(decision: "APPROVED" | "REJECTED") {
    setSubmitting(true);
    setError(null);
    const result = await decideThresholdChange(societyId, proposedChangeId, decision);
    setSubmitting(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-[13px] text-status-error">{error}</p>}
      <div className="flex gap-3">
        <Button type="button" disabled={submitting} onClick={() => decide("APPROVED")}>
          Approve
        </Button>
        <Button type="button" variant="secondary" disabled={submitting} onClick={() => decide("REJECTED")}>
          Reject
        </Button>
      </div>
    </div>
  );
}
