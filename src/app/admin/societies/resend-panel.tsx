"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resendSocietyActivationEmail, searchActiveSocieties } from "./actions";

const DEBOUNCE_MS = 250;

interface Candidate {
  id: string;
  label: string;
}

/**
 * Live server-side search rather than a client-side-filtered dropdown —
 * matches are fetched per keystroke (see searchActiveSocieties) instead of
 * shipping every active society to the browser up front.
 */
export function ResendActivationPanel() {
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleQueryChange(next: string) {
    setQuery(next);
    setSelected(null);
    setError(null);
    setSent(false);
    setOpen(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (next.trim().length < 2) {
      setResults([]);
      return;
    }
    timeoutRef.current = setTimeout(async () => {
      setResults(await searchActiveSocieties(next));
    }, DEBOUNCE_MS);
  }

  function select(candidate: Candidate) {
    setSelected(candidate);
    setQuery(candidate.label);
    setOpen(false);
    setResults([]);
  }

  async function handleResend() {
    if (!selected) return;
    setSending(true);
    setError(null);
    setSent(false);
    const result = await resendSocietyActivationEmail(selected.id);
    setSending(false);
    if (result?.error) setError(result.error);
    else setSent(true);
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="text-[15px] font-semibold text-text-primary">Resend activation email</p>
        <p className="text-[13px] text-text-secondary">
          Lost the original email? Find the society by name and resend its account manager&apos;s activation link.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div ref={containerRef} className="relative sm:max-w-sm sm:flex-1">
          <Input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Search societies…"
            autoComplete="off"
          />
          {open && query.trim().length >= 2 && (
            <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border-subtle bg-background-primary py-1 shadow-md">
              {results.length === 0 ? (
                <p className="px-3 py-2 text-[13px] text-text-tertiary">No matches</p>
              ) : (
                results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => select(r)}
                    className="flex w-full items-center px-3 py-2 text-left text-[14px] text-text-primary transition-colors hover:bg-background-tertiary"
                  >
                    {r.label}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <Button type="button" disabled={!selected || sending} onClick={handleResend}>
          {sending ? "Sending…" : "Resend"}
        </Button>
      </div>
      {sent && <p className="text-[13px] text-status-success">Activation email resent.</p>}
      {error && <p className="text-[13px] text-status-error">{error}</p>}
    </Card>
  );
}
