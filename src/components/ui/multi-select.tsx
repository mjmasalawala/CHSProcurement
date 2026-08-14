"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  label: string;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" aria-hidden>
      <path d="M2.5 6.5L4.5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Searchable multi-select combobox — selected options render as removable
 * chips, typing filters the dropdown list below. Built for option lists that
 * can grow past what a CheckboxGroup pill-wall can comfortably show (e.g.
 * requirement categories, which admins can add to over time).
 */
export function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = "Search…",
  className,
}: {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

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

  const selectedOptions = options.filter((o) => selected.includes(o.id));
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));

  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id));
    else onChange([...selected, id]);
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        onClick={() => setOpen(true)}
        className="flex min-h-[38px] w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-border-strong bg-background-primary px-2 py-1.5 transition-shadow duration-150 focus-within:border-accent-primary focus-within:ring-2 focus-within:ring-accent-primary/15"
      >
        {selectedOptions.map((o) => (
          <span
            key={o.id}
            className="flex items-center gap-1 rounded-full bg-accent-subtle px-2.5 py-1 text-[13px] font-medium text-accent-primary"
          >
            {o.label}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(o.id);
              }}
              aria-label={`Remove ${o.label}`}
              className="text-accent-primary/70 hover:text-accent-primary"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={selectedOptions.length === 0 ? placeholder : ""}
          className="min-w-[100px] flex-1 border-0 bg-transparent px-1 py-0.5 text-[15px] text-text-primary outline-none placeholder:text-text-tertiary"
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border-subtle bg-background-primary py-1 shadow-md">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-[13px] text-text-tertiary">No matches</p>
          ) : (
            filtered.map((o) => {
              const isSelected = selected.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] transition-colors hover:bg-background-tertiary",
                    isSelected ? "font-medium text-accent-primary" : "text-text-primary",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      isSelected ? "border-accent-primary bg-accent-primary text-white" : "border-border-strong",
                    )}
                  >
                    {isSelected && <CheckIcon />}
                  </span>
                  {o.label}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
