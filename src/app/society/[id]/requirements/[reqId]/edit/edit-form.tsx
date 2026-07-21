"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { descriptionPlaceholderFor } from "@/lib/requirement-placeholders";
import { updateRequirement, type RequirementEditInput } from "../actions";

interface Props {
  societyId: string;
  requirementId: string;
  categories: { id: string; name: string }[];
  initial: RequirementEditInput;
}

export function EditRequirementForm({ societyId, requirementId, categories, initial }: Props) {
  const [form, setForm] = useState<RequirementEditInput>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof RequirementEditInput>(key: K, value: RequirementEditInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const selectedCategoryNames = categories.filter((c) => form.categoryIds.includes(c.id)).map((c) => c.name);
  const canSave = !!form.name && form.categoryIds.length > 0 && !!form.description && !!form.bidDeadline;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await updateRequirement(societyId, requirementId, form);
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
    }
    // On success the action redirects — nothing left to do here.
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="name">Project Name</Label>
        <Input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} />
      </div>

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
          rows={8}
        />
      </div>

      <div>
        <Label htmlFor="bidDeadline">Vendors must submit quotes before</Label>
        <DateTimeInput
          id="bidDeadline"
          value={form.bidDeadline}
          onChange={(v) => update("bidDeadline", v)}
        />
      </div>

      {error && <p className="text-[13px] text-status-error">{error}</p>}

      <Button type="submit" className="self-start" disabled={submitting || !canSave}>
        {submitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
