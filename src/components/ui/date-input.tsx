"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortYear(year: number): string {
  return String(year % 100).padStart(2, "0");
}

// dd-mmm-yy — matches formatDate's DD-MMM-YYYY (lib/date.ts) in spirit
// (unambiguous across locales), just with a 2-digit year for these
// compact input boxes.
function formatDateShort(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${String(d).padStart(2, "0")}-${MONTHS[m - 1]}-${shortYear(y)}`;
}

function formatDateTimeShort(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${shortYear(d.getFullYear())}, ${time}`;
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden>
      <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 8h14M7 2.5v3M13 2.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Native <input type="date">/"datetime-local"> render their visible text in
// the browser/OS locale format, which can't be restyled via CSS — so the
// native control is kept (fully functional: picker, keyboard entry, form
// submission via `name`) but made invisible and stacked on top of a
// same-sized display showing our own dd-mmm-yy formatting underneath.
function BaseDateInput({
  id,
  name,
  type,
  value,
  defaultValue,
  onChange,
  min,
  max,
  required,
  className,
  placeholder,
  format,
}: {
  id?: string;
  name?: string;
  type: "date" | "datetime-local";
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  className?: string;
  placeholder: string;
  format: (value: string) => string;
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? value ?? "");
  const current = isControlled ? value : internal;
  // format() returns "" for an incomplete/unparseable native value (e.g.
  // mid-entry while typing segment-by-segment) — fall back to the
  // placeholder rather than rendering a blank box in that case.
  const formatted = current ? format(current) : "";

  return (
    <div className={cn("relative", className)}>
      <div
        aria-hidden
        className="pointer-events-none flex h-[38px] w-full items-center gap-1.5 rounded-lg border border-border-strong bg-background-primary px-3 text-[15px]"
      >
        <CalendarIcon />
        <span className={formatted ? "text-text-primary" : "text-text-tertiary"}>{formatted || placeholder}</span>
      </div>
      <input
        id={id}
        name={name}
        type={type}
        aria-label={placeholder}
        {...(isControlled ? { value } : { defaultValue })}
        onChange={(e) => {
          if (!isControlled) setInternal(e.target.value);
          onChange?.(e.target.value);
        }}
        min={min}
        max={max}
        required={required}
        className="absolute inset-0 h-[38px] w-full cursor-pointer opacity-0"
      />
    </div>
  );
}

interface DateInputProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  className?: string;
}

export function DateInput(props: DateInputProps) {
  return <BaseDateInput {...props} type="date" placeholder="dd-mmm-yy" format={formatDateShort} />;
}

export function DateTimeInput(props: DateInputProps) {
  return <BaseDateInput {...props} type="datetime-local" placeholder="dd-mmm-yy, --:--" format={formatDateTimeShort} />;
}
