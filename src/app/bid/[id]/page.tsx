import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * Redirect-only route — exists purely so the wisesoc_bid_uploaded_v1
 * WhatsApp template's "View your quote" button has somewhere valid to link
 * to. Meta's dynamic URL buttons only allow the variable as a bare trailing
 * suffix on a fixed base URL — nothing static may follow it — so the button
 * can't point straight at /vendor/{vendorCompanyId}/requirements/{requirementId}
 * (two varying segments). This route's own URL has nothing after the Bid
 * id, satisfying that constraint, and just forwards on to the real page
 * (same pattern as app/vendor-profile/[id]/page.tsx).
 */
export default async function BidRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const bid = await prisma.bid.findUnique({
    where: { id },
    select: { vendorCompanyId: true, requirementId: true },
  });
  if (!bid) notFound();

  redirect(`/vendor/${bid.vendorCompanyId}/requirements/${bid.requirementId}`);
}
