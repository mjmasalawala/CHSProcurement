"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { proposeThresholdChange, decideThresholdChange } from "./actions";

/**
 * Displays the current threshold; Office Bearers with propose permission
 * (not the Manager) get an Edit button that turns the same value into an
 * inline input instead of a separate "propose new value" form — submitting
 * still goes through the same co-approval workflow (proposeThresholdChange).
 */
export function ThresholdCard({
  societyId,
  currentValue,
  canPropose,
}: {
  societyId: string;
  currentValue: string;
  canPropose: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentValue);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await proposeThresholdChange(societyId, value);
    setSubmitting(false);
    if (result?.error) setError(result.error);
    else setEditing(false);
  }

  return (
    <Card className="flex flex-col gap-2">
      <p className="text-[13px] font-medium text-text-secondary">Approval threshold</p>

      {editing ? (
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              type="number"
              min={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              required
            />
            {error && <p className="mt-1 text-[13px] text-status-error">{error}</p>}
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Proposing…" : "Propose"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={() => {
              setEditing(false);
              setValue(currentValue);
              setError(null);
            }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-[28px] font-bold tracking-tight text-text-primary">₹{currentValue}</p>
          {canPropose && (
            <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      )}

      <p className="text-[13px] text-text-secondary">
        Recommendations below this amount auto-finalize; at or above, 2 of 3 Office Bearers must approve.
      </p>
    </Card>
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
