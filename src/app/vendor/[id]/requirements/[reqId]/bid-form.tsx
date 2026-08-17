"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isValidGstin, calcLineItemAmounts, calcQuoteTotals } from "@/lib/gst";
import { submitBid, suggestBidLineItems, saveBidDraft, previewBidPdf, type BidLineItemInput } from "./actions";

const UNITS = ["sqft", "sqm", "nos", "lump sum", "kg", "hour", "day", "month", "other"];

const EMPTY_LINE_ITEM: BidLineItemInput = { description: "", quantity: "1", unit: "nos", unitRate: "", gstRate: "" };

// Description gets the lion's share of the row so AI-suggested text isn't
// clipped; Qty/Unit/Rate/Subtotal are fixed-width since their values are
// always short. Trailing 28px column is the remove button. A GST-compliant
// quote inserts one extra fixed-width column for the per-line GST %.
const LINE_ITEM_GRID =
  "grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_84px_108px_108px_108px_28px] sm:items-center sm:gap-3";
const LINE_ITEM_GRID_GST =
  "grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_84px_108px_108px_84px_108px_28px] sm:items-center sm:gap-3";
const COLUMN_HEADER = "text-[12px] font-semibold text-text-secondary";

interface DraftQuote {
  bidValidity: string;
  paymentTerms: string;
  warrantyPeriod: string;
  completionTime: string;
  notes: string;
  gstCompliant: boolean;
  gstNumber: string;
  lineItems: BidLineItemInput[];
}

interface Props {
  vendorCompanyId: string;
  requirementId: string;
  existingBid: DraftQuote | null;
  draft: DraftQuote | null;
  suggestDisabled: boolean;
  // Vendor's own GSTIN on file (VendorCompany.gstNumber), used to pre-fill
  // the GST field the first time they mark a quote GST-compliant.
  vendorGstNumber: string | null;
  // Set when the vendor company is suspended — the server actions already
  // reject these calls, but disabling the fieldset keeps the vendor from
  // hitting that error in the first place.
  disabled?: boolean;
}

export function BidForm({
  vendorCompanyId,
  requirementId,
  existingBid,
  draft,
  suggestDisabled,
  vendorGstNumber,
  disabled = false,
}: Props) {
  // A real submitted Bid always wins over a saved draft — the draft is only
  // there to survive a vendor navigating away before they've actually
  // submitted (prisma/schema.prisma BidDraft comment).
  const initial = existingBid ?? draft;
  const [lineItems, setLineItems] = useState<BidLineItemInput[]>(
    initial?.lineItems.length ? initial.lineItems : [{ ...EMPTY_LINE_ITEM }],
  );
  const [bidValidity, setBidValidity] = useState(initial?.bidValidity ?? "");
  const [paymentTerms, setPaymentTerms] = useState(initial?.paymentTerms ?? "");
  const [warrantyPeriod, setWarrantyPeriod] = useState(initial?.warrantyPeriod ?? "");
  const [completionTime, setCompletionTime] = useState(initial?.completionTime ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [gstCompliant, setGstCompliant] = useState(initial?.gstCompliant ?? false);
  const [gstNumber, setGstNumber] = useState(initial?.gstNumber || vendorGstNumber || "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestUsed, setSuggestUsed] = useState(suggestDisabled);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const { subtotal, totalGst, grandTotal } = useMemo(() => {
    const computed = lineItems.map((li) => {
      const quantity = Number(li.quantity);
      const unitRate = Number(li.unitRate);
      const gstRate = gstCompliant ? Number(li.gstRate) : null;
      if (!Number.isFinite(quantity) || !Number.isFinite(unitRate)) return { amount: 0, gstAmount: 0 };
      return calcLineItemAmounts({ quantity, unitRate, gstRate: Number.isFinite(gstRate) ? gstRate : null });
    });
    return calcQuoteTotals(computed.map((c) => ({ amount: c.amount, gstAmount: c.gstAmount ?? 0 })));
  }, [lineItems, gstCompliant]);

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
    const suggested = result.lineItems.map((li) => ({ ...li, unitRate: "", gstRate: "" }));
    setLineItems((items) => (isBlankSingleRow ? suggested : [...items, ...suggested]));
  }

  function currentInput() {
    return { lineItems, bidValidity, paymentTerms, warrantyPeriod, completionTime, notes, gstCompliant, gstNumber };
  }

  async function handleSaveDraft() {
    setSavingDraft(true);
    setDraftSaved(false);
    const result = await saveBidDraft(vendorCompanyId, requirementId, currentInput());
    setSavingDraft(false);
    if (result?.error) setError(result.error);
    else setDraftSaved(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await submitBid(vendorCompanyId, requirementId, currentInput());
    setSubmitting(false);
    if (result?.error) setError(result.error);
    else setSubmitted(true);
  }

  async function handlePreview() {
    setPreviewing(true);
    setPreviewError(null);
    const result = await previewBidPdf(vendorCompanyId, requirementId, currentInput());
    setPreviewing(false);
    if ("error" in result) {
      setPreviewError(result.error);
      return;
    }
    const bytes = Uint8Array.from(atob(result.pdfBase64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const grid = gstCompliant ? LINE_ITEM_GRID_GST : LINE_ITEM_GRID;
  const gstNumberValid = !gstCompliant || isValidGstin(gstNumber);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <fieldset disabled={disabled} className="contents">
      <Card className="flex flex-col gap-3">
        <h2 className="text-[18px] font-semibold text-text-primary">
          {existingBid ? "Edit your quote" : "Submit a quote"}
        </h2>

        <div className="flex flex-col">
          <div className={cn(grid, "hidden border-b border-border-subtle pb-2 sm:grid")}>
            <span className={COLUMN_HEADER}>Description</span>
            <span className={COLUMN_HEADER}>Qty</span>
            <span className={COLUMN_HEADER}>Unit</span>
            <span className={COLUMN_HEADER}>Rate (₹)</span>
            {gstCompliant && <span className={COLUMN_HEADER}>GST %</span>}
            <span className={cn(COLUMN_HEADER, "text-right")}>Subtotal (₹)</span>
            <span />
          </div>

          {lineItems.map((li, i) => {
            const lineSubtotal = (Number(li.quantity) || 0) * (Number(li.unitRate) || 0);
            return (
              <div key={i} className={cn(grid, "border-b border-border-subtle py-3 last:border-b-0")}>
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
                {gstCompliant && (
                  <div>
                    <Label className="sm:hidden">GST %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      placeholder="0"
                      value={li.gstRate}
                      onChange={(e) => updateLineItem(i, { gstRate: e.target.value })}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between sm:justify-end">
                  <span className="text-[13px] font-medium text-text-secondary sm:hidden">Subtotal</span>
                  <span className="text-[15px] font-semibold tabular-nums text-text-primary">
                    ₹{lineSubtotal.toFixed(2)}
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

        <div className="flex flex-col items-end gap-1 border-t border-border-subtle pt-3">
          {gstCompliant ? (
            <>
              <p className="text-[13px] text-text-secondary">Subtotal: ₹{subtotal.toFixed(2)}</p>
              <p className="text-[13px] text-text-secondary">Total GST: ₹{totalGst.toFixed(2)}</p>
              <p className="text-[18px] font-bold text-text-primary">Grand Total: ₹{grandTotal.toFixed(2)}</p>
            </>
          ) : (
            <p className="text-[18px] font-bold text-text-primary">Total Quote Amount: ₹{subtotal.toFixed(2)}</p>
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={gstCompliant}
            onChange={(e) => setGstCompliant(e.target.checked)}
            className="mt-0.5 size-4 accent-accent-primary"
          />
          <span>
            <span className="block text-[14px] font-medium text-text-primary">GST compliant quote</span>
            <span className="block text-[13px] text-text-secondary">
              Adds your GSTIN to the quote PDF and calculates GST per line item. Leave a line item&apos;s GST %
              at 0 if it isn&apos;t taxable.
            </span>
          </span>
        </label>
        {gstCompliant && (
          <div className="max-w-xs">
            <Label htmlFor="gstNumber">Your GSTIN</Label>
            <Input
              id="gstNumber"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
            />
            {gstNumber && !gstNumberValid && (
              <p className="mt-1 text-[13px] text-status-error">Enter a valid 15-character GSTIN.</p>
            )}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <Label htmlFor="bidValidity">Quote Validity (date)</Label>
          <DateInput id="bidValidity" value={bidValidity} onChange={setBidValidity} className="w-2/5" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="paymentTerms">Payment Terms</Label>
            <Input
              id="paymentTerms"
              placeholder="e.g. 50% advance, 50% on completion"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="warrantyPeriod">Guarantee / Warranty Period</Label>
            <Input
              id="warrantyPeriod"
              placeholder="e.g. 1 year"
              value={warrantyPeriod}
              onChange={(e) => setWarrantyPeriod(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="completionTime">Time to Complete Job</Label>
            <Input
              id="completionTime"
              placeholder="e.g. 2 weeks"
              value={completionTime}
              onChange={(e) => setCompletionTime(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="notes">Notes / Terms</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Card>

      {error && <p className="text-[13px] text-status-error">{error}</p>}
      {previewError && <p className="text-[13px] text-status-error">{previewError}</p>}
      {submitted && !error && <p className="text-[13px] text-status-success">Quote submitted.</p>}
      {draftSaved && <p className="text-[13px] text-status-success">Draft saved.</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={submitting} className="self-start">
          {submitting ? "Submitting…" : existingBid ? "Update quote" : "Submit quote"}
        </Button>
        <Button type="button" variant="secondary" onClick={handleSaveDraft} disabled={savingDraft}>
          {savingDraft ? "Saving…" : "Save Draft Quote"}
        </Button>
        <Button type="button" variant="secondary" onClick={handlePreview} disabled={previewing}>
          {previewing ? "Preparing preview…" : "Preview PDF"}
        </Button>
      </div>
      </fieldset>
    </form>
  );
}
