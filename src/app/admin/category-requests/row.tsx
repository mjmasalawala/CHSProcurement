"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { approveCategoryRequest, rejectCategoryRequest } from "./actions";

export function CategoryRequestRow({
  id,
  name,
  vendorName,
}: {
  id: string;
  name: string;
  vendorName: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [resolved, setResolved] = useState<"approved" | "rejected" | null>(null);

  if (resolved) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border-subtle p-4">
        <p className="text-[15px] text-text-primary">{name}</p>
        <p className="text-[13px] text-text-secondary">{resolved}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border-subtle p-4">
      <div>
        <p className="text-[15px] font-medium text-text-primary">{name}</p>
        <p className="text-[13px] text-text-secondary">Requested by {vendorName ?? "—"}</p>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await approveCategoryRequest(id);
            setResolved("approved");
          }}
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await rejectCategoryRequest(id);
            setResolved("rejected");
          }}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
