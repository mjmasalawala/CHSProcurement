"use client";

import { useState } from "react";
import { WizardShell } from "@/components/ui/wizard-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { registerSociety, type SocietyRegistrationInput } from "./actions";

const TOTAL_STEPS = 4;

interface Props {
  cities: { id: string; name: string }[];
}

export function SocietyRegistrationWizard({ cities }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<SocietyRegistrationInput>({
    name: "",
    address: "",
    cityId: "",
    unitsCount: "",
    registrationNumber: "",
    secretaryName: "",
    secretaryPhone: "",
    secretaryEmail: "",
  });

  function update<K extends keyof SocietyRegistrationInput>(
    key: K,
    value: SocietyRegistrationInput[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canProceed = {
    1: !!(form.name && form.address && form.cityId),
    2: !!form.unitsCount,
    3: !!(form.secretaryName && form.secretaryPhone && form.secretaryEmail),
    4: true,
  }[step];

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await registerSociety(form);
    if ("error" in result) {
      setError(result.error);
      setSubmitting(false);
    } else {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <Card className="w-full max-w-lg">
        <h1 className="mb-2 text-[18px] font-semibold text-text-primary">
          Thanks — we&apos;ll review your registration
        </h1>
        <p className="text-[15px] text-text-secondary">
          ProSoc will verify {form.name} and email {form.secretaryEmail} an activation link once
          approved.
        </p>
      </Card>
    );
  }

  return (
    <div className="w-full">
      {step === 1 && (
        <WizardShell
          step={1}
          totalSteps={TOTAL_STEPS}
          title="Tell us about your society"
          onNext={() => setStep(2)}
          nextDisabled={!canProceed}
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

      {step === 2 && (
        <WizardShell
          step={2}
          totalSteps={TOTAL_STEPS}
          title="Society details"
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          nextDisabled={!canProceed}
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

      {step === 3 && (
        <WizardShell
          step={3}
          totalSteps={TOTAL_STEPS}
          title="Who's the Secretary?"
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
          nextDisabled={!canProceed}
        >
          <p className="text-[13px] text-text-secondary">
            The Secretary will receive an activation link once ProSoc approves the society, and can
            invite the Manager and other Office Bearers from there.
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
          </div>
        </WizardShell>
      )}

      {step === 4 && (
        <WizardShell step={4} totalSteps={TOTAL_STEPS} title="Review &amp; submit" onBack={() => setStep(3)}>
          <ReviewRow label="Society" value={`${form.name} — ${cities.find((c) => c.id === form.cityId)?.name ?? ""}`} />
          <ReviewRow label="Address" value={form.address} />
          <ReviewRow label="Units" value={form.unitsCount} />
          <ReviewRow label="Secretary" value={`${form.secretaryName} · ${form.secretaryEmail}`} />
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
