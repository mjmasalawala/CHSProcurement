"use client";

import { useState } from "react";
import { WizardShell } from "@/components/ui/wizard-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createRequirement, type RequirementCreationInput } from "../actions";

const TOTAL_STEPS = 3;

interface Props {
  societyId: string;
  categories: { id: string; name: string }[];
}

export function RequirementWizard({ societyId, categories }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<RequirementCreationInput>({
    categoryId: "",
    description: "",
    budgetBand: "",
    urgency: "",
    bidDeadline: "",
  });

  function update<K extends keyof RequirementCreationInput>(key: K, value: RequirementCreationInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canProceed = {
    1: !!(form.categoryId && form.description),
    2: !!form.urgency,
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
          title="What do you need done?"
          onNext={() => setStep(2)}
          nextDisabled={!canProceed}
        >
          <div>
            <Label htmlFor="categoryId">Category</Label>
            <Select
              id="categoryId"
              value={form.categoryId}
              onChange={(e) => update("categoryId", e.target.value)}
            >
              <option value="">Select one</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
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

      {step === 2 && (
        <WizardShell
          step={2}
          totalSteps={TOTAL_STEPS}
          title="How urgent, and what's the budget?"
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          nextDisabled={!canProceed}
        >
          <div>
            <Label htmlFor="urgency">Urgency</Label>
            <Select id="urgency" value={form.urgency} onChange={(e) => update("urgency", e.target.value)}>
              <option value="">Select one</option>
              <option value="ROUTINE">Routine</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="budgetBand">Estimated Budget Band (optional)</Label>
            <Input
              id="budgetBand"
              value={form.budgetBand}
              onChange={(e) => update("budgetBand", e.target.value)}
              placeholder="e.g. ₹10,000 - ₹25,000"
            />
          </div>
        </WizardShell>
      )}

      {step === 3 && (
        <WizardShell
          step={3}
          totalSteps={TOTAL_STEPS}
          title="Bid submission deadline"
          onBack={() => setStep(2)}
        >
          <div>
            <Label htmlFor="bidDeadline">Vendors must bid before</Label>
            <Input
              id="bidDeadline"
              type="datetime-local"
              value={form.bidDeadline}
              onChange={(e) => update("bidDeadline", e.target.value)}
            />
            <p className="mt-1 text-[13px] text-text-secondary">
              Submitting invites the matched vendor pool automatically — you can&apos;t hand-pick who&apos;s
              invited.
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
