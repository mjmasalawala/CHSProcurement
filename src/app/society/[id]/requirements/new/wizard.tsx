"use client";

import { useState } from "react";
import { WizardShell } from "@/components/ui/wizard-shell";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { descriptionPlaceholderFor } from "@/lib/requirement-placeholders";
import { createRequirement, checkDescriptionCompleteness, type RequirementCreationInput } from "../actions";

type Phase = "name" | "details" | "clarify" | "review" | "deadline";

// "clarify"/"review" only appear in the sequence once the completeness
// check comes back with questions — computed fresh each time so a society
// that goes back and re-answers doesn't end up on a stale sequence.
function stepSequence(hasQuestions: boolean): Phase[] {
  return hasQuestions ? ["name", "details", "clarify", "review", "deadline"] : ["name", "details", "deadline"];
}

// datetime-local expects "YYYY-MM-DDTHH:mm" in local time, no timezone suffix.
function defaultBidDeadline(): string {
  const twoDaysOut = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${twoDaysOut.getFullYear()}-${pad(twoDaysOut.getMonth() + 1)}-${pad(twoDaysOut.getDate())}T${pad(
    twoDaysOut.getHours(),
  )}:${pad(twoDaysOut.getMinutes())}`;
}

function appendAnsweredDetails(baseDescription: string, questions: string[], answers: string[]): string {
  const answered = questions
    .map((q, i) => ({ q, a: answers[i]?.trim() ?? "" }))
    .filter(({ a }) => a);
  if (!answered.length) return baseDescription;
  const block = answered.map(({ q, a }) => `- ${q} ${a}`).join("\n");
  return `${baseDescription}\n\nAdditional details:\n${block}`;
}

interface Props {
  societyId: string;
  categories: { id: string; name: string }[];
}

export function RequirementWizard({ societyId, categories }: Props) {
  const [phase, setPhase] = useState<Phase>("name");
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<RequirementCreationInput>({
    categoryIds: [],
    name: "",
    description: "",
    bidDeadline: defaultBidDeadline(),
  });
  // The free-text description as the society originally typed it, before any
  // Q&A gets appended — kept separately so re-answering clarifying questions
  // after going back always rebuilds from the original, not a
  // previously-merged one.
  const [baseDescription, setBaseDescription] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);

  function update<K extends keyof RequirementCreationInput>(key: K, value: RequirementCreationInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const sequence = stepSequence(questions.length > 0);
  const stepNumber = sequence.indexOf(phase) + 1;
  const totalSteps = sequence.length;

  const selectedCategoryNames = categories.filter((c) => form.categoryIds.includes(c.id)).map((c) => c.name);

  async function handleDetailsNext() {
    setChecking(true);
    setBaseDescription(form.description);
    const result = await checkDescriptionCompleteness(societyId, form.categoryIds, form.description);
    setChecking(false);
    if (result.questions.length > 0) {
      setQuestions(result.questions);
      setAnswers(new Array(result.questions.length).fill(""));
      setPhase("clarify");
    } else {
      setQuestions([]);
      setPhase("deadline");
    }
  }

  function handleClarifyNext() {
    update("description", appendAnsweredDetails(baseDescription, questions, answers));
    setPhase("review");
  }

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
      {phase === "name" && (
        <WizardShell
          step={stepNumber}
          totalSteps={totalSteps}
          title="What's this project called?"
          onNext={() => setPhase("details")}
          nextDisabled={!form.name}
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

      {phase === "details" && (
        <WizardShell
          step={stepNumber}
          totalSteps={totalSteps}
          title="What do you need done?"
          onBack={() => setPhase("name")}
          onNext={handleDetailsNext}
          nextDisabled={form.categoryIds.length === 0 || !form.description || checking}
          nextLabel={checking ? "Checking…" : "Next"}
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
              placeholder={descriptionPlaceholderFor(selectedCategoryNames)}
            />
          </div>
        </WizardShell>
      )}

      {phase === "clarify" && (
        <WizardShell
          step={stepNumber}
          totalSteps={totalSteps}
          title="A few more details"
          onBack={() => setPhase("details")}
          onNext={handleClarifyNext}
        >
          <p className="text-[13px] text-text-secondary">
            Vendors will need this to quote accurately — answer what you can, or skip what you don&apos;t know.
          </p>
          {questions.map((q, i) => (
            <div key={q}>
              <Label htmlFor={`clarify-${i}`}>{q}</Label>
              <Input
                id={`clarify-${i}`}
                value={answers[i] ?? ""}
                onChange={(e) => setAnswers((a) => a.map((v, idx) => (idx === i ? e.target.value : v)))}
                placeholder="Skip if you're not sure"
              />
            </div>
          ))}
        </WizardShell>
      )}

      {phase === "review" && (
        <WizardShell
          step={stepNumber}
          totalSteps={totalSteps}
          title="Review your requirement"
          onBack={() => setPhase("clarify")}
          onNext={() => setPhase("deadline")}
        >
          <div>
            <Label htmlFor="description-review">Description</Label>
            <Textarea
              id="description-review"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={8}
            />
            <p className="mt-1 text-[13px] text-text-secondary">
              This is what vendors will see — edit anything before continuing.
            </p>
          </div>
        </WizardShell>
      )}

      {phase === "deadline" && (
        <WizardShell
          step={stepNumber}
          totalSteps={totalSteps}
          title="Quote submission deadline"
          onBack={() => setPhase(questions.length > 0 ? "review" : "details")}
        >
          <div>
            <Label htmlFor="bidDeadline">Vendors must submit quotes before</Label>
            <DateTimeInput
              id="bidDeadline"
              value={form.bidDeadline}
              onChange={(v) => update("bidDeadline", v)}
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
            disabled={submitting || !form.bidDeadline}
          >
            {submitting ? "Submitting…" : "Raise requirement"}
          </Button>
        </WizardShell>
      )}
    </div>
  );
}
