"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { submitBid, suggestBidLineItems, saveBidDraft, type BidLineItemInput } from "./actions";

const UNITS = ["sqft", "sqm", "nos", "lump sum", "kg", "hour", "day", "month", "other"];

const EMPTY_LINE_ITEM: BidLineItemInput = { description: "", quantity: "1", unit: "nos", unitRate: "" };

// Description gets the lion's share of the row so AI-suggested text isn't
// clipped; Qty/Unit/Rate/Subtotal are fixed-width since their values are
// always short. Trailing 28px column is the remove button.
const LINE_ITEM_GRID = "grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_84px_108px_108px_108px_28px] sm:items-center sm:gap-3";
const COLUMN_HEADER = "text-[12px] font-semibold text-text-secondary";

interface DraftQuote {
  bidValidity: string;
  notes: string;
  lineItems: BidLineItemInput[];
}

interface Props {
  vendorCompanyId: string;
  requirementId: string;
  existingBid: DraftQuote | null;
  draft: DraftQuote | null;
  suggestDisabled: boolean;
}

export function BidForm({ vendorCompanyId, requirementId, existingBid, draft, suggestDisabled }: Props) {
  // A real submitted Bid always wins over a saved draft — the draft is only
  // there to survive a vendor navigating away before they've actually
  // submitted (prisma/schema.prisma BidDraft comment).
  const initial = existingBid ?? draft;
  const [lineItems, setLineItems] = useState<BidLineItemInput[]>(
    initial?.lineItems.length ? initial.lineItems : [{ ...EMPTY_LINE_ITEM }],
  );
  const [bidValidity, setBidValidity] = useState(initial?.bidValidity ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestUsed, setSuggestUsed] = useState(suggestDisabled);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const total = useMemo(
    () =>
      lineItems.reduce((sum, li) => {
        const qty = Number(li.quantity);
        const rate = Number(li.unitRate);
        return sum + (Number.isFinite(qty) && Number.isFinite(rate) ? qty * rate : 0);
      }, 0),
    [lineItems],
  );

  function updateLineItem(index: number, patch: Partial<BidLineItemInput>) {
    setLineItems((items) => items.map((li, i) => (i === index ? { ...li, ...patch } : li)));
    setSubmitted(false);
    setDraftSaved(false);
  }

  function addLineItem() {
    setLineItems((items) => [...items, { ...EMPTY_LINE_ITEM }]);
  }

  function removeLineItem(index: number) {
    setLineItems((items) => items.filter((_, i) => i !== index));
  }

  const isBlankSingleRow = lineItems.length === 1 && !lineItems[0].description.trim();

  async function handleSuggest() {
    setSuggesting(true);
    setSuggestError(null);
    const result = await suggestBidLineItems(vendorCompanyId, requirementId);
    setSuggesting(false);
    if ("error" in result) {
      setSuggestError(result.error);
      return;
    }
    // The server has already stamped this pair as used (even if it came back
    // with zero rows) — the one-shot allowance is spent either way.
    setSuggestUsed(true);
    if (!result.lineItems.length) {
      setSuggestError("Couldn't draft any line items from the requirement description.");
      return;
    }
    const suggested = result.lineItems.map((li) => ({ ...li, unitRate: "" }));
    setLineItems((items) => (isBlankSingleRow ? suggested : [...items, ...suggested]));
  }

  async function handleSaveDraft() {
    setSavingDraft(true);
    setDraftSaved(false);
    const result = await saveBidDraft(vendorCompanyId, requirementId, { lineItems, bidValidity, notes });
    setSavingDraft(false);
    if (result?.error) setError(result.error);
    else setDraftSaved(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await submitBid(vendorCompanyId, requirementId, { lineItems, bidValidity, notes });
    setSubmitting(false);
    if (result?.error) setError(result.error);
    else setSubmitted(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card className="flex flex-col gap-3">
        <h2 className="text-[18px] font-semibold text-text-primary">
          {existingBid ? "Edit your quote" : "Submit a quote"}
        </h2>

        <div className="flex flex-col">
          <div className={cn(LINE_ITEM_GRID, "hidden border-b border-border-subtle pb-2 sm:grid")}>
            <span className={COLUMN_HEADER}>Description</span>
            <span className={COLUMN_HEADER}>Qty</span>
            <span className={COLUMN_HEADER}>Unit</span>
            <span className={COLUMN_HEADER}>Rate (₹)</span>
            <span className={cn(COLUMN_HEADER, "text-right")}>Subtotal (₹)</span>
            <span />
          </div>

          {lineItems.map((li, i) => {
            const subtotal = (Number(li.quantity) || 0) * (Number(li.unitRate) || 0);
            return (
              <div key={i} className={cn(LINE_ITEM_GRID, "border-b border-border-subtle py-3 last:border-b-0")}>
                <div className="col-span-2 sm:col-span-1">
                  <Label className="sm:hidden">Description</Label>
                  <Input
                    value={li.description}
                    onChange={(e) => updateLineItem(i, { description: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="sm:hidden">Quantity</Label>
                  <Input
                    type="number"
                    min={0}
                    value={li.quantity}
                    onChange={(e) => updateLineItem(i, { quantity: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="sm:hidden">Unit</Label>
                  <Select value={li.unit} onChange={(e) => updateLineItem(i, { unit: e.target.value })}>
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label className="sm:hidden">Unit Rate (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={li.unitRate}
                    onChange={(e) => updateLineItem(i, { unitRate: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between sm:justify-end">
                  <span className="text-[13px] font-medium text-text-secondary sm:hidden">Subtotal</span>
                  <span className="text-[15px] font-semibold tabular-nums text-text-primary">
                    ₹{subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="col-span-2 flex justify-end sm:col-span-1 sm:justify-center">
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLineItem(i)}
                      aria-label="Remove line item"
                      className="rounded-md p-1 text-text-tertiary hover:bg-status-error/10 hover:text-status-error"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                        <path
                          fillRule="evenodd"
                          d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482 41.03 41.03 0 0 0-2.365-.298V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={addLineItem}>
            + Add line item
          </Button>
          <Button type="button" variant="secondary" onClick={handleSuggest} disabled={suggesting || suggestUsed}>
            {suggesting ? "Suggesting…" : suggestUsed ? "Suggestions used" : "Suggest line items"}
          </Button>
          {suggestError && <span className="text-[13px] text-status-error">{suggestError}</span>}
        </div>

        <p className="text-right text-[18px] font-bold text-text-primary">
          Total Quote Amount: ₹{total.toFixed(2)}
        </p>
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <Label htmlFor="bidValidity">Quote Validity (date)</Label>
          <Input
            id="bidValidity"
            type="date"
            value={bidValidity}
            onChange={(e) => setBidValidity(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="notes">Notes / Terms (optional)</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Card>

      {error && <p className="text-[13px] text-status-error">{error}</p>}
      {submitted && !error && <p className="text-[13px] text-status-success">Quote submitted.</p>}
      {draftSaved && <p className="text-[13px] text-status-success">Draft saved.</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={submitting} className="self-start">
          {submitting ? "Submitting…" : existingBid ? "Update quote" : "Submit quote"}
        </Button>
        <Button type="button" variant="secondary" onClick={handleSaveDraft} disabled={savingDraft}>
          {savingDraft ? "Saving…" : "Save Draft Quote"}
        </Button>
      </div>
    </form>
  );
}
