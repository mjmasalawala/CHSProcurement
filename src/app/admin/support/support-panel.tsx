"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { startImpersonation, searchImpersonationCandidates } from "./actions";

const DEBOUNCE_MS = 250;

interface Candidate {
  id: string;
  label: string;
}

/**
 * Live server-side search rather than a client-side-filtered dropdown — the
 * options here are never the full user list, just whatever the current
 * query matched (see searchImpersonationCandidates), so browsing this page
 * never ships every user's email to whoever's signed in as support/admin.
 * A selection can only ever be one of the returned candidates: typing after
 * picking one clears the hidden userId, so the form can't submit freetext.
 */
export function SupportPanel() {
  const [state, formAction, pending] = useActionState(startImpersonation, undefined);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [open, setOpen] = useState(false);
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
    setOpen(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (next.trim().length < 2) {
      setResults([]);
      return;
    }
    timeoutRef.current = setTimeout(async () => {
      setResults(await searchImpersonationCandidates(next));
    }, DEBOUNCE_MS);
  }

  function select(candidate: Candidate) {
    setSelected(candidate);
    setQuery(candidate.label);
    setOpen(false);
    setResults([]);
  }

  return (
    <Card className="flex max-w-lg flex-col gap-4">
      <div>
        <p className="text-[15px] font-semibold text-text-primary">Impersonate a user</p>
        <p className="text-[13px] text-text-secondary">
          Signs you in as this user so you can see and reproduce what they see. Every impersonation is
          logged with your identity and the reason given below.
        </p>
      </div>
      <form action={formAction} className="flex flex-col gap-3">
        <div ref={containerRef} className="relative">
          <Label htmlFor="user-search">User</Label>
          <Input
            id="user-search"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Search by name or email…"
            autoComplete="off"
          />
          <input type="hidden" name="userId" value={selected?.id ?? ""} />
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
        <div>
          <Label htmlFor="reason">Reason</Label>
          <Textarea
            id="reason"
            name="reason"
            required
            rows={3}
            placeholder="e.g. Reproducing a bid submission error reported in ticket #123"
          />
        </div>
        {state?.error && <p className="text-[13px] text-status-error">{state.error}</p>}
        <Button type="submit" disabled={pending || !selected} className="self-start">
          {pending ? "Starting…" : "Start impersonation"}
        </Button>
      </form>
    </Card>
  );
}
