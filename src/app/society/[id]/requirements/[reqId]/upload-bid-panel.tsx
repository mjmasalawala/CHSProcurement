"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import { cn } from "@/lib/utils";
import { isValidGstin, calcLineItemAmounts, calcQuoteTotals } from "@/lib/gst";
import { MAX_BID_DOCUMENT_BYTES, BID_DOCUMENT_CONTENT_TYPES } from "@/lib/bid-documents";
import { extractBidDocument, submitManagerBid, type ManagerBidInput } from "./actions";
import type { BidLineItemInput } from "@/app/vendor/[id]/requirements/[reqId]/actions";

const UNITS = ["sqft", "sqm", "nos", "lump sum", "kg", "hour", "day", "month", "other"];
const EMPTY_LINE_ITEM: BidLineItemInput = { description: "", quantity: "1", unit: "nos", unitRate: "", gstRate: "" };

type Stage = "closed" | "idle" | "uploading" | "extracting" | "review" | "submitting" | "done";

interface Props {
  societyId: string;
  requirementId: string;
  vendorCompanyId: string;
  vendorName: string;
  hasExistingBid: boolean;
}

export function UploadBidPanel({ societyId, requirementId, vendorCompanyId, vendorName, hasExistingBid }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("closed");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [sourceDocumentUrl, setSourceDocumentUrl] = useState<string | null>(null);
  const [documentStatedTotal, setDocumentStatedTotal] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<BidLineItemInput[]>([{ ...EMPTY_LINE_ITEM }]);
  const [bidValidity, setBidValidity] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [warrantyPeriod, setWarrantyPeriod] = useState("");
  const [completionTime, setCompletionTime] = useState("");
  const [notes, setNotes] = useState("");
  const [gstCompliant, setGstCompliant] = useState(false);
  const [gstNumber, setGstNumber] = useState("");

  function reset() {
    setStage("closed");
    setError(null);
    setSourceDocumentUrl(null);
    setDocumentStatedTotal(null);
    setLineItems([{ ...EMPTY_LINE_ITEM }]);
    setBidValidity("");
    setPaymentTerms("");
    setWarrantyPeriod("");
    setCompletionTime("");
    setNotes("");
    setGstCompliant(false);
    setGstNumber("");
  }

  async function handleFile(file: File) {
    setError(null);
    if (!(BID_DOCUMENT_CONTENT_TYPES as readonly string[]).includes(file.type)) {
      setError("Unsupported file type — upload a PDF, image, or Excel file.");
      return;
    }
    if (file.size > MAX_BID_DOCUMENT_BYTES) {
      setError(`"${file.name}" is over ${(MAX_BID_DOCUMENT_BYTES / (1024 * 1024)).toFixed(0)}MB.`);
      return;
    }

    setStage("uploading");
    try {
      const dot = file.name.lastIndexOf(".");
      const ext = dot >= 0 ? file.name.slice(dot) : "";
      const blob = await upload(
        `bid-documents/${societyId}/${requirementId}/${vendorCompanyId}/${crypto.randomUUID()}${ext}`,
        file,
        {
          access: "public",
          handleUploadUrl: "/api/bid-documents/upload",
          clientPayload: JSON.stringify({ actor: "society", societyId }),
        },
      );

      setStage("extracting");
      const result = await extractBidDocument(societyId, requirementId, vendorCompanyId, blob.url, file.type);
      if ("error" in result) {
        setError(result.error);
        setStage("idle");
        return;
      }

      const extracted = result.extracted;
      const anyGst = extracted.lineItems.some((li) => li.gstRate.trim());
      setLineItems(
        extracted.lineItems.length
          ? extracted.lineItems.map((li) => ({ ...li, gstRate: anyGst ? li.gstRate : "" }))
          : [{ ...EMPTY_LINE_ITEM }],
      );
      setGstCompliant(anyGst);
      setBidValidity(extracted.bidValidity ?? "");
      setPaymentTerms(extracted.paymentTerms ?? "");
      setWarrantyPeriod(extracted.warrantyPeriod ?? "");
      setCompletionTime(extracted.completionTime ?? "");
      setNotes(extracted.notes ?? "");
      setGstNumber(extracted.gstNumber ?? "");
      setDocumentStatedTotal(extracted.documentStatedTotal);
      setSourceDocumentUrl(blob.url);
      setStage("review");
    } catch (err) {
      console.error("Bid document upload/extract failed:", err);
      setError(err instanceof Error ? err.message : "Upload failed — please try again.");
      setStage("idle");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function updateLineItem(index: number, patch: Partial<BidLineItemInput>) {
    setLineItems((items) => items.map((li, i) => (i === index ? { ...li, ...patch } : li)));
  }
  function addLineItem() {
    setLineItems((items) => [...items, { ...EMPTY_LINE_ITEM }]);
  }
  function removeLineItem(index: number) {
    setLineItems((items) => items.filter((_, i) => i !== index));
  }

  const { subtotal, totalGst, grandTotal } = (() => {
    const computed = lineItems.map((li) => {
      const quantity = Number(li.quantity);
      const unitRate = Number(li.unitRate);
      const gstRate = gstCompliant ? Number(li.gstRate) : null;
      if (!Number.isFinite(quantity) || !Number.isFinite(unitRate)) return { amount: 0, gstAmount: 0 };
      return calcLineItemAmounts({ quantity, unitRate, gstRate: Number.isFinite(gstRate) ? gstRate : null });
    });
    return calcQuoteTotals(computed.map((c) => ({ amount: c.amount, gstAmount: c.gstAmount ?? 0 })));
  })();

  const statedTotalNumber = documentStatedTotal !== null ? Number(documentStatedTotal) : null;
  const totalMismatch =
    statedTotalNumber !== null &&
    Number.isFinite(statedTotalNumber) &&
    Math.abs(statedTotalNumber - grandTotal) > Math.max(1, statedTotalNumber * 0.01);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceDocumentUrl) return;
    setError(null);
    setStage("submitting");
    const input: ManagerBidInput = {
      lineItems,
      bidValidity,
      paymentTerms,
      warrantyPeriod,
      completionTime,
      notes,
      gstCompliant,
      gstNumber,
    };
    const result = await submitManagerBid(societyId, requirementId, vendorCompanyId, input, sourceDocumentUrl);
    if (result?.error) {
      setError(result.error);
      setStage("review");
      return;
    }
    reset();
    router.refresh();
  }

  if (stage === "closed") {
    return (
      <Button
        type="button"
        variant="secondary"
        className="border-accent-primary text-[12px] text-accent-primary hover:bg-accent-subtle"
        onClick={() => setStage("idle")}
      >
        {hasExistingBid ? "Replace quote" : "Upload quote"}
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-text-primary">Upload quote — {vendorName}</h2>
          <button
            type="button"
            onClick={reset}
            aria-label="Close"
            className="text-[20px] leading-none text-text-tertiary hover:text-text-primary"
          >
            ×
          </button>
        </div>

        {(stage === "idle" || stage === "uploading" || stage === "extracting") && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            className={cn(
              "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-10 text-center",
              dragOver ? "border-accent-primary bg-accent-subtle" : "border-border-subtle",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {stage === "idle" && (
              <>
                <p className="text-[14px] text-text-secondary">
                  Drag and drop the vendor&apos;s quotation (PDF, image, or Excel) here
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="border-accent-primary text-accent-primary hover:bg-accent-subtle"
                  onClick={() => inputRef.current?.click()}
                >
                  Choose file
                </Button>
              </>
            )}
            {stage === "uploading" && <p className="text-[14px] text-text-secondary">Uploading…</p>}
            {stage === "extracting" && (
              <p className="text-[14px] text-text-secondary">Reading the document — this can take a few seconds…</p>
            )}
          </div>
        )}

        {(stage === "review" || stage === "submitting") && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <fieldset disabled={stage === "submitting"} className="contents">
              {totalMismatch && (
                <div className="rounded-lg border border-status-warning-border bg-status-warning-bg p-3">
                  <p className="text-[13px] text-text-secondary">
                    Heads up — the document states a total of ₹{statedTotalNumber?.toFixed(2)}, but these line
                    items add up to ₹{grandTotal.toFixed(2)}. Double-check before submitting.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {lineItems.map((li, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 border-b border-border-subtle pb-2 sm:grid-cols-6">
                    <div className="col-span-2">
                      <Label className="text-[11px]">Description</Label>
                      <Input value={li.description} onChange={(e) => updateLineItem(i, { description: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-[11px]">Qty</Label>
                      <Input
                        type="number"
                        value={li.quantity}
                        onChange={(e) => updateLineItem(i, { quantity: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Unit</Label>
                      <Select value={li.unit} onChange={(e) => updateLineItem(i, { unit: e.target.value })}>
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[11px]">Rate (₹)</Label>
                      <Input
                        type="number"
                        value={li.unitRate}
                        onChange={(e) => updateLineItem(i, { unitRate: e.target.value })}
                      />
                    </div>
                    {gstCompliant && (
                      <div>
                        <Label className="text-[11px]">GST %</Label>
                        <Input
                          type="number"
                          value={li.gstRate}
                          onChange={(e) => updateLineItem(i, { gstRate: e.target.value })}
                        />
                      </div>
                    )}
                    <div className="col-span-2 flex items-end justify-end sm:col-span-1">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(i)}
                          className="text-[12px] text-status-error underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  className="self-start border-accent-primary text-accent-primary hover:bg-accent-subtle"
                  onClick={addLineItem}
                >
                  + Add line item
                </Button>
              </div>

              <div className="flex flex-col items-end gap-1 border-t border-border-subtle pt-3">
                {gstCompliant ? (
                  <>
                    <p className="text-[13px] text-text-secondary">Subtotal: ₹{subtotal.toFixed(2)}</p>
                    <p className="text-[13px] text-text-secondary">Total GST: ₹{totalGst.toFixed(2)}</p>
                    <p className="text-[16px] font-bold text-text-primary">Grand Total: ₹{grandTotal.toFixed(2)}</p>
                  </>
                ) : (
                  <p className="text-[16px] font-bold text-text-primary">Total: ₹{subtotal.toFixed(2)}</p>
                )}
              </div>

              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={gstCompliant}
                  onChange={(e) => setGstCompliant(e.target.checked)}
                  className="mt-0.5 size-4 accent-accent-primary"
                />
                <span className="text-[13px] text-text-primary">GST-compliant quote</span>
              </label>
              {gstCompliant && (
                <div className="max-w-xs">
                  <Label htmlFor={`mb-gst-${vendorCompanyId}`}>Vendor GSTIN</Label>
                  <Input
                    id={`mb-gst-${vendorCompanyId}`}
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                    maxLength={15}
                  />
                  {gstNumber && !isValidGstin(gstNumber) && (
                    <p className="mt-1 text-[13px] text-status-error">Enter a valid 15-character GSTIN.</p>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor={`mb-validity-${vendorCompanyId}`}>Quote Validity</Label>
                <DateInput
                  id={`mb-validity-${vendorCompanyId}`}
                  value={bidValidity}
                  onChange={setBidValidity}
                  className="w-2/5"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor={`mb-payment-${vendorCompanyId}`}>Payment Terms</Label>
                  <Input
                    id={`mb-payment-${vendorCompanyId}`}
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`mb-warranty-${vendorCompanyId}`}>Warranty</Label>
                  <Input
                    id={`mb-warranty-${vendorCompanyId}`}
                    value={warrantyPeriod}
                    onChange={(e) => setWarrantyPeriod(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`mb-completion-${vendorCompanyId}`}>Time to Complete</Label>
                  <Input
                    id={`mb-completion-${vendorCompanyId}`}
                    value={completionTime}
                    onChange={(e) => setCompletionTime(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor={`mb-notes-${vendorCompanyId}`}>Notes / Terms</Label>
                <Textarea id={`mb-notes-${vendorCompanyId}`} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <p className="text-[12px] text-text-tertiary">
                The vendor will be notified by email that this quote was logged on their behalf, and can view or
                edit it from their own dashboard before the deadline.
              </p>

              {error && <p className="text-[13px] text-status-error">{error}</p>}

              <div className="flex gap-3">
                <Button type="submit" disabled={stage === "submitting"}>
                  {stage === "submitting" ? "Submitting…" : "Confirm and submit quote"}
                </Button>
                <Button type="button" variant="ghost" onClick={reset}>
                  Cancel
                </Button>
              </div>
            </fieldset>
          </form>
        )}

        {stage === "idle" && error && <p className="text-[13px] text-status-error">{error}</p>}
      </Card>
    </div>
  );
}
