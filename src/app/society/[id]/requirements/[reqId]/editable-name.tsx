"use client";

import { useState } from "react";
import { updateRequirementName } from "./actions";

interface Props {
  societyId: string;
  requirementId: string;
  initialName: string;
  canEdit: boolean;
}

export function EditableProjectName({ societyId, requirementId, initialName, canEdit }: Props) {
  const [value, setValue] = useState(initialName);
  const [saving, setSaving] = useState(false);

  if (!canEdit) {
    return <h1 className="text-[28px] font-bold tracking-tight text-text-primary">{initialName}</h1>;
  }

  async function handleBlur() {
    const trimmed = value.trim();
    if (!trimmed) {
      setValue(initialName);
      return;
    }
    if (trimmed === initialName) return;

    setSaving(true);
    const result = await updateRequirementName(societyId, requirementId, trimmed);
    setSaving(false);
    if (result?.error) setValue(initialName);
  }

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      disabled={saving}
      className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-[28px] font-bold tracking-tight text-text-primary hover:border-border-subtle focus:border-accent-primary focus:outline-none disabled:opacity-60"
    />
  );
}
