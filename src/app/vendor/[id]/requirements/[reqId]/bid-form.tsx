"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { submitBid, type BidLineItemInput } from "./actions";

const UNITS = ["sqft", "sqm", "nos", "lump sum", "kg", "hour", "day", "month", "other"];

const EMPTY_LINE_ITEM: BidLineItemInput = { description: "", quantity: "1", unit: "nos", unitRate: "" };

interface Props {
  vendorCompanyId: string;
  requirementId: string;
  existingBid: { bidValidity: string; notes: string; lineItems: BidLineItemInput[] } | null;
}

export function BidForm({ vendorCompanyId, requirementId, existingBid }: Props) {
  const [lineItems, setLineItems] = useState<BidLineItemInput[]>(
    existingBid?.lineItems.length ? existingBid.lineItems : [{ ...EMPTY_LINE_ITEM }],
  );
  const [bidValidity, setBidValidity] = useState(existingBid?.bidValidity ?? "");
  const [notes, setNotes] = useState(existingBid?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
  }

  function addLineItem() {
    setLineItems((items) => [...items, { ...EMPTY_LINE_ITEM }]);
  }

  function removeLineItem(index: number) {
    setLineItems((items) => items.filter((_, i) => i !== index));
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
          {existingBid ? "Edit your bid" : "Submit a bid"}
        </h2>

        <div className="flex flex-col gap-3">
          {lineItems.map((li, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-border-subtle p-3 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <Label>Description</Label>
                <Input
                  value={li.description}
                  onChange={(e) => updateLineItem(i, { description: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={0}
                  value={li.quantity}
                  onChange={(e) => updateLineItem(i, { quantity: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Unit</Label>
                <Select value={li.unit} onChange={(e) => updateLineItem(i, { unit: e.target.value })}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Unit Rate (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={li.unitRate}
                  onChange={(e) => updateLineItem(i, { unitRate: e.target.value })}
                />
              </div>
              <div className="flex items-end justify-between sm:col-span-1">
                <p className="text-[13px] text-text-secondary">
                  ₹{((Number(li.quantity) || 0) * (Number(li.unitRate) || 0)).toFixed(2)}
                </p>
                {lineItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLineItem(i)}
                    aria-label="Remove line item"
                    className="text-text-secondary hover:text-status-error"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <Button type="button" variant="secondary" onClick={addLineItem} className="self-start">
          + Add line item
        </Button>

        <p className="text-right text-[18px] font-bold text-text-primary">
          Total Bid Amount: ₹{total.toFixed(2)}
        </p>
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <Label htmlFor="bidValidity">Bid Validity (date)</Label>
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
      {submitted && !error && <p className="text-[13px] text-status-success">Bid submitted.</p>}

      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? "Submitting…" : existingBid ? "Update bid" : "Submit bid"}
      </Button>
    </form>
  );
}
