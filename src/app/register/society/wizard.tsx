"use client";

import { useState } from "react";
import { WizardShell } from "@/components/ui/wizard-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { registerSociety } from "./actions";
import { REGISTRANT_ROLES, INVITEE_ROLES, type SocietyRegistrationInput } from "./data";
import { isValidEmail } from "@/lib/validation";

const ROLE_LABELS: Record<string, string> = {
  MANAGER: "Manager",
  CHAIRMAN: "Chairman",
  SECRETARY: "Secretary",
  TREASURER: "Treasurer",
  GB_MEMBER: "General Body Member",
};

// The step sequence depends on who's registering — a GB Member needs an
// extra "who should manage the account" step (they hold no permissions
// themselves), and the Secretary's contact step is skipped whenever whoever
// will actually run the account (the invitee, for a GB Member registrant —
// otherwise the registrant themselves) already is the Secretary, since
// there's no point asking twice.
function buildSteps(registrantRole: string, inviteeRole: string): string[] {
  const steps = ["basics", "details", "registrant"];
  const isGbMember = registrantRole === "GB_MEMBER";
  if (isGbMember) steps.push("invitee");
  const accountManagerRole = isGbMember ? inviteeRole : registrantRole;
  if (accountManagerRole !== "SECRETARY") steps.push("secretary");
  steps.push("review");
  return steps;
}

interface Props {
  cities: { id: string; name: string }[];
}

export function SocietyRegistrationWizard({ cities }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<SocietyRegistrationInput>({
    name: "",
    address: "",
    cityId: "",
    unitsCount: "",
    registrationNumber: "",
    registrantRole: "",
    registrantName: "",
    registrantPhone: "",
    registrantEmail: "",
    secretaryName: "",
    secretaryPhone: "",
    secretaryEmail: "",
    inviteeRole: "",
    inviteeName: "",
    inviteePhone: "",
    inviteeEmail: "",
  });

  function update<K extends keyof SocietyRegistrationInput>(
    key: K,
    value: SocietyRegistrationInput[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const isGbMember = form.registrantRole === "GB_MEMBER";
  const steps = buildSteps(form.registrantRole, form.inviteeRole);
  const stepKey = steps[stepIndex];
  const totalSteps = steps.length;
  const accountManagerRole = isGbMember ? form.inviteeRole : form.registrantRole;
  const isSecretary = accountManagerRole === "SECRETARY";

  const canProceed: Record<string, boolean> = {
    basics: !!(form.name && form.address && form.cityId),
    details: !!form.unitsCount,
    registrant: !!(
      form.registrantRole &&
      form.registrantName &&
      form.registrantPhone &&
      isValidEmail(form.registrantEmail)
    ),
    invitee: !!(form.inviteeRole && form.inviteeName && form.inviteePhone && isValidEmail(form.inviteeEmail)),
    secretary: !!(form.secretaryName && form.secretaryPhone && isValidEmail(form.secretaryEmail)),
    review: true,
  };

  function goNext() {
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await registerSociety(form);
      if ("error" in result) {
        setError(result.error);
        setSubmitting(false);
      } else {
        setSubmitted(true);
      }
    } catch {
      // Belt-and-suspenders: registerSociety shouldn't throw (notification
      // failures are caught server-side), but if it ever does, don't leave
      // the button stuck on "Submitting…" forever.
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="w-full max-w-lg">
        <h1 className="mb-2 text-[18px] font-semibold text-text-primary">
          Thanks — we&apos;ll review your registration
        </h1>
        <p className="text-[15px] text-text-secondary">
          ProSoc will verify {form.name} and email the account activation link once approved.
        </p>
      </Card>
    );
  }

  return (
    <div className="w-full">
      {stepKey === "basics" && (
        <WizardShell
          step={stepIndex + 1}
          totalSteps={totalSteps}
          title="Tell us about your society"
          onNext={goNext}
          nextDisabled={!canProceed.basics}
        >
          <div>
            <Label htmlFor="name">Society Name</Label>
            <Input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" value={form.address} onChange={(e) => update("address", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cityId">City</Label>
            <Select id="cityId" value={form.cityId} onChange={(e) => update("cityId", e.target.value)}>
              <option value="">Select a city</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </WizardShell>
      )}

      {stepKey === "details" && (
        <WizardShell
          step={stepIndex + 1}
          totalSteps={totalSteps}
          title="Society details"
          onBack={goBack}
          onNext={goNext}
          nextDisabled={!canProceed.details}
        >
          <div>
            <Label htmlFor="unitsCount">Number of Units/Flats</Label>
            <Input
              id="unitsCount"
              type="number"
              min={1}
              value={form.unitsCount}
              onChange={(e) => update("unitsCount", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="registrationNumber">RWA/Society Registration Number</Label>
            <Input
              id="registrationNumber"
              value={form.registrationNumber}
              onChange={(e) => update("registrationNumber", e.target.value)}
              placeholder="Optional"
            />
          </div>
        </WizardShell>
      )}

      {stepKey === "registrant" && (
        <WizardShell
          step={stepIndex + 1}
          totalSteps={totalSteps}
          title="Who's registering?"
          onBack={goBack}
          onNext={goNext}
          nextDisabled={!canProceed.registrant}
        >
          <p className="text-[13px] text-text-secondary">
            The Secretary doesn&apos;t have to be the one who signs up — any Manager, Office Bearer, or
            General Body Member can register the society.
          </p>
          <div>
            <Label htmlFor="registrantRole">Your Role</Label>
            <Select
              id="registrantRole"
              value={form.registrantRole}
              onChange={(e) => update("registrantRole", e.target.value as SocietyRegistrationInput["registrantRole"])}
            >
              <option value="">Select your role</option>
              {REGISTRANT_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="registrantName">Your Name</Label>
            <Input
              id="registrantName"
              autoComplete="name"
              value={form.registrantName}
              onChange={(e) => update("registrantName", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="registrantPhone">Your Phone</Label>
            <Input
              id="registrantPhone"
              autoComplete="tel"
              value={form.registrantPhone}
              onChange={(e) => update("registrantPhone", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="registrantEmail">Your Email</Label>
            <Input
              id="registrantEmail"
              type="email"
              autoComplete="email"
              value={form.registrantEmail}
              onChange={(e) => update("registrantEmail", e.target.value)}
            />
            {form.registrantEmail && !isValidEmail(form.registrantEmail) && (
              <p className="mt-1 text-[13px] text-status-error">Enter a valid email address.</p>
            )}
          </div>
        </WizardShell>
      )}

      {stepKey === "invitee" && (
        <WizardShell
          step={stepIndex + 1}
          totalSteps={totalSteps}
          title="Who should manage the account?"
          onBack={goBack}
          onNext={goNext}
          nextDisabled={!canProceed.invitee}
        >
          <p className="text-[13px] text-text-secondary">
            As a General Body Member you won&apos;t get a ProSoc login yourself — tell us who should
            receive the activation invite to set up a password and run the account.
          </p>
          <div>
            <Label htmlFor="inviteeRole">Their Role</Label>
            <Select
              id="inviteeRole"
              value={form.inviteeRole}
              onChange={(e) => update("inviteeRole", e.target.value as SocietyRegistrationInput["inviteeRole"])}
            >
              <option value="">Select a role</option>
              {INVITEE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="inviteeName">Their Name</Label>
            <Input id="inviteeName" value={form.inviteeName} onChange={(e) => update("inviteeName", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inviteePhone">Their Phone</Label>
            <Input id="inviteePhone" value={form.inviteePhone} onChange={(e) => update("inviteePhone", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inviteeEmail">Their Email</Label>
            <Input
              id="inviteeEmail"
              type="email"
              value={form.inviteeEmail}
              onChange={(e) => update("inviteeEmail", e.target.value)}
            />
            {form.inviteeEmail && !isValidEmail(form.inviteeEmail) && (
              <p className="mt-1 text-[13px] text-status-error">Enter a valid email address.</p>
            )}
          </div>
        </WizardShell>
      )}

      {stepKey === "secretary" && (
        <WizardShell
          step={stepIndex + 1}
          totalSteps={totalSteps}
          title="Who's the Secretary?"
          onBack={goBack}
          onNext={goNext}
          nextDisabled={!canProceed.secretary}
        >
          <p className="text-[13px] text-text-secondary">
            We keep the Secretary&apos;s details on file for every society, even if they&apos;re not the
            one setting up the account.
          </p>
          <div>
            <Label htmlFor="secretaryName">Secretary Name</Label>
            <Input
              id="secretaryName"
              autoComplete="name"
              value={form.secretaryName}
              onChange={(e) => update("secretaryName", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="secretaryPhone">Secretary Phone</Label>
            <Input
              id="secretaryPhone"
              autoComplete="tel"
              value={form.secretaryPhone}
              onChange={(e) => update("secretaryPhone", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="secretaryEmail">Secretary Email</Label>
            <Input
              id="secretaryEmail"
              type="email"
              autoComplete="email"
              value={form.secretaryEmail}
              onChange={(e) => update("secretaryEmail", e.target.value)}
            />
            {form.secretaryEmail && !isValidEmail(form.secretaryEmail) && (
              <p className="mt-1 text-[13px] text-status-error">Enter a valid email address.</p>
            )}
          </div>
        </WizardShell>
      )}

      {stepKey === "review" && (
        <WizardShell step={stepIndex + 1} totalSteps={totalSteps} title="Review &amp; submit" onBack={goBack}>
          <ReviewRow label="Society" value={`${form.name} — ${cities.find((c) => c.id === form.cityId)?.name ?? ""}`} />
          <ReviewRow label="Address" value={form.address} />
          <ReviewRow label="Units" value={form.unitsCount} />
          <ReviewRow
            label="Registrant"
            value={`${form.registrantName} · ${ROLE_LABELS[form.registrantRole] ?? ""} · ${form.registrantEmail}`}
          />
          {!isSecretary && (
            <ReviewRow label="Secretary" value={`${form.secretaryName} · ${form.secretaryEmail}`} />
          )}
          {isGbMember && (
            <ReviewRow
              label="Account manager"
              value={`${form.inviteeName} · ${ROLE_LABELS[form.inviteeRole] ?? ""} · ${form.inviteeEmail}`}
            />
          )}
          {error && <p className="text-[13px] text-status-error">{error}</p>}
          <Button type="button" className="w-full" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit registration"}
          </Button>
        </WizardShell>
      )}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] text-text-secondary">{label}</p>
      <p className="text-[15px] text-text-primary">{value || "—"}</p>
    </div>
  );
}
