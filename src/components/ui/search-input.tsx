"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "./input";

const DEBOUNCE_MS = 300;

// URL-param-driven search (?q= by default) — same searchParams-filtering
// idiom the requirements/bids/archive pages already use for status tabs and
// the archive filter form, just live instead of submit-based. Debounced so
// typing doesn't fire a query per keystroke; wrapped in useTransition so the
// previous results stay on screen (no blank flash) while the new ones load.
export function SearchInput({
  placeholder = "Search…",
  paramName = "q",
}: {
  placeholder?: string;
  paramName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get(paramName) ?? "");
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleChange(next: string) {
    setValue(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.trim()) params.set(paramName, next.trim());
      else params.delete(paramName);
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }, DEBOUNCE_MS);
  }

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pr-9"
      />
      {isPending && (
        <span
          aria-hidden
          className="absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-border-strong border-t-accent-primary"
        />
      )}
    </div>
  );
}
