"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  label: string;
}

/**
 * Single-select searchable combobox — type to filter, click a suggestion to
 * select it. Unlike a plain text input, the selected value can only ever be
 * one of `options`: typing without picking a suggestion clears any prior
 * selection rather than accepting the typed text as-is, so callers never
 * have to guard against arbitrary freetext standing in for a real id.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  options: Option[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));

  function select(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        value={open ? query : (selectedOption?.label ?? "")}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border-strong bg-background-primary px-3 py-2 text-[15px] text-text-primary outline-none transition-shadow duration-150 focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/15"
      />

      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border-subtle bg-background-primary py-1 shadow-md">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-[13px] text-text-tertiary">No matches</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => select(o.id)}
                className="flex w-full items-center px-3 py-2 text-left text-[14px] text-text-primary transition-colors hover:bg-background-tertiary"
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
