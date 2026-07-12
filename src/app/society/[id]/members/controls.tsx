"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { inviteMember, setMemberActive } from "./actions";
import type { RoleName } from "@/generated/prisma/enums";

const ROLE_OPTIONS: { value: RoleName; label: string }[] = [
  { value: "MANAGER", label: "Manager" },
  { value: "CHAIRMAN", label: "Chairman" },
  { value: "TREASURER", label: "Treasurer" },
];

export function InviteMemberForm({ societyId }: { societyId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleName>("CHAIRMAN");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await inviteMember(societyId, email, role);
    setSubmitting(false);
    if (result?.error) setError(result.error);
    else setEmail("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <Select value={role} onChange={(e) => setRole(e.target.value as RoleName)} className="w-36 shrink-0">
        {ROLE_OPTIONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Select>
      <div className="flex-1">
        <Input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {error && <p className="mt-1 text-[13px] text-status-error">{error}</p>}
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Inviting…" : "Invite"}
      </Button>
    </form>
  );
}

export function ToggleMemberButton({
  societyId,
  roleAssignmentId,
  active,
}: {
  societyId: string;
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
        await setMemberActive(societyId, roleAssignmentId, !active);
        setPending(false);
      }}
    >
      {active ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
