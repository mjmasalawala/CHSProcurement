"use client";

import { useState } from "react";
import { WizardShell } from "@/components/ui/wizard-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createRequirement, type RequirementCreationInput } from "../actions";

const TOTAL_STEPS = 3;

// datetime-local expects "YYYY-MM-DDTHH:mm" in local time, no timezone suffix.
function defaultBidDeadline(): string {
  const twoDaysOut = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${twoDaysOut.getFullYear()}-${pad(twoDaysOut.getMonth() + 1)}-${pad(twoDaysOut.getDate())}T${pad(
    twoDaysOut.getHours(),
  )}:${pad(twoDaysOut.getMinutes())}`;
}

interface Props {
  societyId: string;
  categories: { id: string; name: string }[];
}

export function RequirementWizard({ societyId, categories }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<RequirementCreationInput>({
    categoryIds: [],
    name: "",
    description: "",
    bidDeadline: defaultBidDeadline(),
  });

  function update<K extends keyof RequirementCreationInput>(key: K, value: RequirementCreationInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canProceed = {
    1: !!form.name,
    2: form.categoryIds.length > 0 && !!form.description,
    3: !!form.bidDeadline,
  }[step];

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await createRequirement(societyId, form);
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full">
      {step === 1 && (
        <WizardShell
          step={1}
          totalSteps={TOTAL_STEPS}
          title="What's this project called?"
          onNext={() => setStep(2)}
          nextDisabled={!canProceed}
        >
          <div>
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Lobby ceiling repair"
            />
          </div>
        </WizardShell>
      )}

      {step === 2 && (
        <WizardShell
          step={2}
          totalSteps={TOTAL_STEPS}
          title="What do you need done?"
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          nextDisabled={!canProceed}
        >
          <div>
            <Label htmlFor="categoryIds">Categories</Label>
            <CheckboxGroup
              options={categories.map((c) => ({ id: c.id, label: c.name }))}
              selected={form.categoryIds}
              onChange={(ids) => update("categoryIds", ids)}
            />
            <p className="mt-1 text-[13px] text-text-secondary">
              Select every trade this project needs — vendors are matched if they service any one of them.
            </p>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="What needs fixing, where, and any relevant details."
            />
          </div>
        </WizardShell>
      )}

      {step === 3 && (
        <WizardShell
          step={3}
          totalSteps={TOTAL_STEPS}
          title="Quote submission deadline"
          onBack={() => setStep(2)}
        >
          <div>
            <Label htmlFor="bidDeadline">Vendors must submit quotes before</Label>
            <Input
              id="bidDeadline"
              type="datetime-local"
              value={form.bidDeadline}
              onChange={(e) => update("bidDeadline", e.target.value)}
            />
            <p className="mt-1 text-[13px] text-text-secondary">
              Vendors will be matched with you automatically. They will need to submit their quotes by the
              submission deadline.
            </p>
          </div>
          {error && <p className="text-[13px] text-status-error">{error}</p>}
          <Button
            type="button"
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting || !canProceed}
          >
            {submitting ? "Submitting…" : "Raise requirement"}
          </Button>
        </WizardShell>
      )}
    </div>
  );
}
