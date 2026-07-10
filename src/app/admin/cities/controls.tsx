"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCity, setCityActive } from "./actions";

export function AddCityForm() {
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
        const result = await createCity(name);
        if (result?.error) {
          setError(result.error);
        } else {
          setName("");
        }
        setBusy(false);
      }}
    >
      <div className="flex-1">
        <Input placeholder="New city name" value={name} onChange={(e) => setName(e.target.value)} />
        {error && <p className="mt-1 text-[13px] text-status-error">{error}</p>}
      </div>
      <Button type="submit" disabled={busy || !name.trim()}>
        Add
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
        await setCityActive(id, !active);
        setBusy(false);
      }}
    >
      {active ? "Deactivate" : "Activate"}
    </Button>
  );
}
