"use client";

import { formatDate, formatDuration } from "@/lib/date";
import { UploadBidPanel } from "./upload-bid-panel";

export interface InvitedVendorRow {
  id: string;
  vendorCompanyId: string;
  vendorName: string;
  createdAt: Date;
  bidAt: Date | null;
}

interface Props {
  societyId: string;
  requirementId: string;
  invites: InvitedVendorRow[];
  closed: boolean;
  bidDeadline: Date;
  canUploadBid: boolean;
}

/**
 * The "N vendors matched and invited" table on the requirement detail page —
 * pulled into its own client component so each row can offer the Manager an
 * "Upload quote on behalf" action (society-portal-spec.md manager-upload
 * feature) without turning the whole page client-side.
 */
export function InvitedVendorsTable({ societyId, requirementId, invites, closed, bidDeadline, canUploadBid }: Props) {
  if (invites.length === 0) {
    return <p className="mt-2 text-text-tertiary">No vendors matched yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="mt-2 w-full text-left">
        <thead>
          <tr className="border-b border-border-subtle text-[11px] uppercase tracking-wide text-text-tertiary">
            <th className="py-1.5 pr-3 font-semibold">Vendor</th>
            <th className="py-1.5 pr-3 font-semibold">Matched</th>
            <th className="py-1.5 pr-3 font-semibold">Time given</th>
            <th className="py-1.5 pr-3 font-semibold">Quoted</th>
            {canUploadBid && !closed && <th className="py-1.5 font-semibold" />}
          </tr>
        </thead>
        <tbody>
          {invites.map((inv) => {
            const windowEnd = closed ? bidDeadline : new Date();
            const givenMs = Math.max(0, windowEnd.getTime() - inv.createdAt.getTime());
            return (
              <tr key={inv.id} className="border-b border-border-subtle last:border-0">
                <td className="py-1.5 pr-3 align-top font-medium whitespace-nowrap text-text-primary">
                  {inv.vendorName}
                </td>
                <td className="py-1.5 pr-3 align-top whitespace-nowrap">{formatDate(inv.createdAt)}</td>
                <td className="py-1.5 pr-3 align-top whitespace-nowrap">{formatDuration(givenMs)}</td>
                <td className="py-1.5 pr-3 align-top whitespace-nowrap">
                  {inv.bidAt ? formatDate(inv.bidAt) : "—"}
                </td>
                {canUploadBid && !closed && (
                  <td className="py-1.5 align-top">
                    <UploadBidPanel
                      societyId={societyId}
                      requirementId={requirementId}
                      vendorCompanyId={inv.vendorCompanyId}
                      vendorName={inv.vendorName}
                      hasExistingBid={!!inv.bidAt}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
