"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/date-input";
import { extendRequirementDeadline } from "./actions";

export function ExtendDeadlineButton({ societyId, requirementId }: { societyId: string; requirementId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) {
    return (
      <Button type="button" className="self-start" onClick={() => setOpen(true)}>
        Extend Deadline
      </Button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await extendRequirementDeadline(societyId, requirementId, deadline);
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div>
        <DateTimeInput
          value={deadline}
          onChange={setDeadline}
          min={new Date(Date.now() + 60 * 1000).toISOString().slice(0, 16)}
          required
        />
        {error && <p className="mt-1 text-[13px] text-status-error">{error}</p>}
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save new deadline"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}
