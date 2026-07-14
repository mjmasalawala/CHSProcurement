"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCategory, setCategoryActive, renameCategory } from "./actions";

export function AddCategoryForm() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const result = await createCategory(name);
        if (result?.error) {
          setError(result.error);
        } else {
          setName("");
        }
        setBusy(false);
      }}
    >
      <div className="flex-1">
        <Input
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {error && <p className="mt-1 text-[13px] text-status-error">{error}</p>}
      </div>
      <Button type="submit" disabled={busy || !name.trim()}>
        Add
      </Button>
    </form>
  );
}

export function RenameCategoryButton({ id, name }: { id: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setValue(name);
          setError(null);
          setEditing(true);
        }}
      >
        Rename
      </Button>
    );
  }

  return (
    <form
      className="flex items-start gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const result = await renameCategory(id, value);
        setBusy(false);
        if (result?.error) setError(result.error);
        else setEditing(false);
      }}
    >
      <div>
        <Input value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        {error && <p className="mt-1 text-[13px] text-status-error">{error}</p>}
      </div>
      <Button type="submit" disabled={busy || !value.trim()}>
        Save
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={busy}
        onClick={() => {
          setEditing(false);
          setError(null);
        }}
      >
        Cancel
      </Button>
    </form>
  );
}

export function ToggleActiveButton({ id, active }: { id: string; active: boolean }) {
  const [busy, setBusy] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await setCategoryActive(id, !active);
        setBusy(false);
      }}
    >
      {active ? "Deactivate" : "Activate"}
    </Button>
  );
}
