"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { recommendBid } from "./actions";

interface BidLineItem {
  description: string;
  quantity: string;
  unit: string;
  unitRate: string;
  amount: string;
}

interface BidCardData {
  id: string;
  vendorName: string;
  totalAmount: string;
  bidValidity: string;
  paymentTerms: string | null;
  warrantyPeriod: string | null;
  completionTime: string | null;
  notes: string | null;
  lineItems: BidLineItem[];
}

interface Props {
  societyId: string;
  requirementId: string;
  bids: BidCardData[];
  recommendedBidId: string | null;
  recommendationNote: string | null;
  canRecommend: boolean;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-3.5 w-3.5 shrink-0 text-text-tertiary transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Rows = vendors (a "bid tabulation sheet"), not vendor-per-card — cards
// stop being scannable somewhere around 4-5 quotes, whereas a sorted table
// keeps working at 8+ (society-portal-spec.md doesn't cap invited vendors).
// Line items stay free text per vendor (not tabulated across vendors) —
// product decision: descriptions aren't standardized, so a shared row-per-
// line-item comparison would require either a fixed item catalog or fuzzy
// matching, both out of scope for now.
export function BidComparison({
  societyId,
  requirementId,
  bids,
  recommendedBidId,
  recommendationNote,
  canRecommend,
}: Props) {
  const router = useRouter();
  const lowestAmount = Math.min(...bids.map((b) => Number(b.totalAmount)));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [justifyingBidId, setJustifyingBidId] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleExpanded(bidId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(bidId)) next.delete(bidId);
      else next.add(bidId);
      return next;
    });
  }

  async function handleRecommend(bidId: string, isLowest: boolean) {
    if (!isLowest && justifyingBidId !== bidId) {
      setJustifyingBidId(bidId);
      setJustification("");
      setError(null);
      setExpandedIds((prev) => new Set(prev).add(bidId));
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await recommendBid(societyId, requirementId, bidId, justification);
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setJustifyingBidId(null);
    // recommendBid can finalize immediately (below threshold) or move the
    // requirement to AWAITING_APPROVAL — this page's Approval panel /
    // Finalized card are server-rendered from requirement.status, so
    // without a refresh they'd stay hidden until the next full navigation.
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[18px] font-semibold text-text-primary">Quote comparison</h2>
      {error && <p className="text-[13px] text-status-error">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border-subtle bg-background-secondary text-[11px] uppercase tracking-wide text-text-tertiary">
              <th className="w-8 py-2 pl-3"></th>
              <th className="py-2 pr-3 font-semibold">Vendor</th>
              <th className="py-2 pr-3 font-semibold">Total</th>
              <th className="py-2 pr-3 font-semibold">vs lowest</th>
              <th className="hidden py-2 pr-3 font-semibold sm:table-cell">Valid until</th>
              <th className="py-2 pr-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {bids.map((bid) => {
              const isLowest = Number(bid.totalAmount) === lowestAmount;
              const isRecommended = bid.id === recommendedBidId;
              const isOpen = expandedIds.has(bid.id);
              const delta = Number(bid.totalAmount) - lowestAmount;
              const deltaPct = lowestAmount > 0 ? (delta / lowestAmount) * 100 : 0;

              return (
                <Fragment key={bid.id}>
                  <tr
                    onClick={() => toggleExpanded(bid.id)}
                    className={`cursor-pointer border-b border-border-subtle last:border-0 hover:bg-background-tertiary ${
                      isRecommended ? "bg-status-success-bg" : ""
                    }`}
                  >
                    <td className="pl-3">
                      <ChevronIcon open={isOpen} />
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-text-primary">
                      {bid.vendorName}
                      {isRecommended && (
                        <Badge tone="success" className="ml-2">
                          Recommended
                        </Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3">
                      <span className="font-semibold text-text-primary">₹{Number(bid.totalAmount).toFixed(2)}</span>
                      {isLowest && (
                        <Badge tone="success" className="ml-2">
                          Lowest
                        </Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-text-secondary">
                      {isLowest ? "—" : `+₹${delta.toFixed(2)} · +${deltaPct.toFixed(1)}%`}
                    </td>
                    <td className="hidden whitespace-nowrap py-2.5 pr-3 text-text-secondary sm:table-cell">
                      {bid.bidValidity}
                    </td>
                    <td className="py-2.5 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {!isRecommended && canRecommend && (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={submitting || !!recommendedBidId}
                          onClick={() => handleRecommend(bid.id, isLowest)}
                        >
                          {justifyingBidId === bid.id ? "Confirm recommendation" : "Recommend"}
                        </Button>
                      )}
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="border-b border-border-subtle bg-background-secondary/60 last:border-0">
                      <td colSpan={6} className="px-3 py-4">
                        <div className="flex flex-col gap-4">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b border-border-subtle text-[11px] uppercase tracking-wide text-text-tertiary">
                                  <th className="pb-1.5 pr-2 font-semibold">Description</th>
                                  <th className="pb-1.5 pr-2 text-right font-semibold">Qty</th>
                                  <th className="pb-1.5 pr-2 font-semibold">Unit</th>
                                  <th className="pb-1.5 pr-2 text-right font-semibold">Rate (₹)</th>
                                  <th className="pb-1.5 text-right font-semibold">Amount (₹)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {bid.lineItems.map((li, i) => (
                                  <tr key={i} className="border-b border-border-subtle last:border-0">
                                    <td className="py-1.5 pr-2 text-text-primary">{li.description}</td>
                                    <td className="py-1.5 pr-2 text-right text-text-secondary">{li.quantity}</td>
                                    <td className="py-1.5 pr-2 text-text-secondary">{li.unit}</td>
                                    <td className="py-1.5 pr-2 text-right text-text-secondary">{li.unitRate}</td>
                                    <td className="py-1.5 text-right font-medium text-text-primary">{li.amount}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {(bid.paymentTerms || bid.warrantyPeriod || bid.completionTime) && (
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                              {bid.paymentTerms && (
                                <div>
                                  <p className="text-text-tertiary">Payment terms</p>
                                  <p className="text-text-primary">{bid.paymentTerms}</p>
                                </div>
                              )}
                              {bid.warrantyPeriod && (
                                <div>
                                  <p className="text-text-tertiary">Warranty</p>
                                  <p className="text-text-primary">{bid.warrantyPeriod}</p>
                                </div>
                              )}
                              {bid.completionTime && (
                                <div>
                                  <p className="text-text-tertiary">Time to complete</p>
                                  <p className="text-text-primary">{bid.completionTime}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {bid.notes && (
                            <div>
                              <p className="text-text-tertiary">Notes</p>
                              <p className="text-text-primary">{bid.notes}</p>
                            </div>
                          )}

                          {isRecommended && recommendationNote && (
                            <div>
                              <p className="text-text-tertiary">Justification</p>
                              <p className="text-text-primary">{recommendationNote}</p>
                            </div>
                          )}

                          {justifyingBidId === bid.id && !isRecommended && (
                            <div onClick={(e) => e.stopPropagation()}>
                              <Label htmlFor={`justification-${bid.id}`}>
                                This isn&apos;t the lowest quote — justification required
                              </Label>
                              <Textarea
                                id={`justification-${bid.id}`}
                                value={justification}
                                onChange={(e) => setJustification(e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
