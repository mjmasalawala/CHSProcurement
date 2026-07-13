"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  inviteMember,
  setMemberActive,
  resendMemberInvite,
  proposeRemoveMember,
  decideRemoveMember,
} from "./actions";
import type { RoleName } from "@/generated/prisma/enums";

const ROLE_OPTIONS: { value: RoleName; label: string }[] = [
  { value: "MANAGER", label: "Manager" },
  { value: "CHAIRMAN", label: "Chairman" },
  { value: "TREASURER", label: "Treasurer" },
];

export function InviteMemberForm({
  societyId,
  occupiedRoles = [],
}: {
  societyId: string;
  occupiedRoles?: RoleName[];
}) {
  const firstAvailable = ROLE_OPTIONS.find((r) => !occupiedRoles.includes(r.value))?.value ?? "MANAGER";
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleName>(firstAvailable);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (occupiedRoles.includes(role)) {
      setError(`This society already has an active ${role.toLowerCase()} — deactivate them first.`);
      return;
    }
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
          <option key={r.value} value={r.value} disabled={occupiedRoles.includes(r.value)}>
            {r.label}
            {occupiedRoles.includes(r.value) ? " (filled)" : ""}
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

const RESEND_COOLDOWN_SECONDS = 60;

export function ResendInviteButton({
  societyId,
  roleAssignmentId,
}: {
  societyId: string;
  roleAssignmentId: string;
}) {
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  return (
    // Fixed width regardless of whether `error` is showing — that's what
    // keeps the button from shifting left when the message appears. Normal
    // (non-absolute) flow so the row grows to fit a wrapped error instead of
    // the message hanging past the row's bottom border.
    <div className="flex w-44 flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        disabled={pending || cooldown > 0}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await resendMemberInvite(societyId, roleAssignmentId);
          setPending(false);
          if (result?.error) setError(result.error);
          else setCooldown(RESEND_COOLDOWN_SECONDS);
        }}
      >
        {pending ? "Sending…" : cooldown > 0 ? `Sent (${cooldown}s)` : "Resend Invite"}
      </Button>
      {error && <p className="text-right text-[12px] text-status-error">{error}</p>}
    </div>
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

export function ProposeRemovalButton({
  societyId,
  roleAssignmentId,
}: {
  societyId: string;
  roleAssignmentId: string;
}) {
  const [pending, setPending] = useState(false);
  const [proposed, setProposed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (proposed) {
    return <p className="text-[13px] text-text-secondary">Removal proposed — awaiting a second Office Bearer</p>;
  }

  return (
    <div className="flex w-44 flex-col items-end gap-1">
      <Button
        type="button"
        variant="danger"
        disabled={pending}
        onClick={async () => {
          if (!confirm("Propose removing this member? A different Office Bearer will need to approve it.")) return;
          setPending(true);
          setError(null);
          const result = await proposeRemoveMember(societyId, roleAssignmentId);
          setPending(false);
          if (result?.error) setError(result.error);
          else setProposed(true);
        }}
      >
        {pending ? "Proposing…" : "Propose Removal"}
      </Button>
      {error && <p className="text-right text-[12px] text-status-error">{error}</p>}
    </div>
  );
}

export function DecideRemovalPanel({
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
    const result = await decideRemoveMember(societyId, proposedChangeId, decision);
    setSubmitting(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-[13px] text-status-error">{error}</p>}
      <div className="flex gap-3">
        <Button type="button" variant="danger" disabled={submitting} onClick={() => decide("APPROVED")}>
          Approve removal
        </Button>
        <Button type="button" variant="secondary" disabled={submitting} onClick={() => decide("REJECTED")}>
          Reject
        </Button>
      </div>
    </div>
  );
}
