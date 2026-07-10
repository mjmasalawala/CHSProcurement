"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { inviteStaff, setStaffActive } from "./actions";

export function InviteStaffForm({ vendorCompanyId }: { vendorCompanyId: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await inviteStaff(vendorCompanyId, email);
    setSubmitting(false);
    if (result?.error) setError(result.error);
    else setEmail("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex-1">
        <Input
          type="email"
          placeholder="staff@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {error && <p className="mt-1 text-[13px] text-status-error">{error}</p>}
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Inviting…" : "Invite staff"}
      </Button>
    </form>
  );
}

export function ToggleStaffButton({
  vendorCompanyId,
  roleAssignmentId,
  active,
}: {
  vendorCompanyId: string;
  roleAssignmentId: string;
  active: boolean;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await setStaffActive(vendorCompanyId, roleAssignmentId, !active);
        setPending(false);
      }}
    >
      {active ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
