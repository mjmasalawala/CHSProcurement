"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
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

export function BidComparison({
  societyId,
  requirementId,
  bids,
  recommendedBidId,
  recommendationNote,
  canRecommend,
}: Props) {
  const lowestAmount = Math.min(...bids.map((b) => Number(b.totalAmount)));
  const [justifyingBidId, setJustifyingBidId] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRecommend(bidId: string, isLowest: boolean) {
    if (!isLowest && justifyingBidId !== bidId) {
      setJustifyingBidId(bidId);
      setJustification("");
      setError(null);
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await recommendBid(societyId, requirementId, bidId, justification);
    setSubmitting(false);
    if (result?.error) setError(result.error);
    else setJustifyingBidId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[18px] font-semibold text-text-primary">Quote comparison</h2>
      {error && <p className="text-[13px] text-status-error">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {bids.map((bid) => {
          const isLowest = Number(bid.totalAmount) === lowestAmount;
          const isRecommended = bid.id === recommendedBidId;

          return (
            <Card
              key={bid.id}
              className={
                isRecommended
                  ? "border-status-success-border bg-status-success-bg"
                  : "transition-shadow hover:shadow-md"
              }
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[15px] font-semibold text-text-primary">{bid.vendorName}</p>
                  <p className="text-[13px] text-text-secondary">Valid until {bid.bidValidity}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="text-[18px] font-bold tracking-tight text-text-primary">
                    ₹{Number(bid.totalAmount).toFixed(2)}
                  </p>
                  {isLowest && <Badge tone="success">Lowest quote</Badge>}
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-1">
                {bid.lineItems.map((li, i) => (
                  <p key={i} className="text-[13px] text-text-secondary">
                    {li.description} — {li.quantity} {li.unit} × ₹{li.unitRate} = ₹{li.amount}
                  </p>
                ))}
              </div>

              {bid.notes && <p className="mt-2 text-[13px] text-text-secondary">Notes: {bid.notes}</p>}

              {isRecommended ? (
                <div className="mt-4 rounded-lg bg-background-primary p-3 shadow-xs">
                  <Badge tone="success">Recommended</Badge>
                  {recommendationNote && (
                    <p className="mt-2 text-[13px] text-text-secondary">Justification: {recommendationNote}</p>
                  )}
                </div>
              ) : canRecommend ? (
                <div className="mt-4 flex flex-col gap-2">
                  {justifyingBidId === bid.id && (
                    <div>
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
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={submitting || !!recommendedBidId}
                    onClick={() => handleRecommend(bid.id, isLowest)}
                  >
                    {justifyingBidId === bid.id ? "Confirm recommendation" : "Recommend"}
                  </Button>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
