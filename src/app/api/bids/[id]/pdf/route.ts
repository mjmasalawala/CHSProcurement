import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderSubmittedBidPdf } from "@/lib/bid-pdf";

// Vendor: always allowed to download their own quote. Society: only once
// bidding has closed — quotes stay blind until the deadline everywhere else
// in the app, and this raw URL is the one place that rule could otherwise
// be bypassed by guessing a bid id before the deadline.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session) return new NextResponse("Not authorized.", { status: 401 });

  const bid = await prisma.bid.findUnique({
    where: { id },
    select: { vendorCompanyId: true, requirement: { select: { societyId: true, bidDeadline: true } } },
  });
  if (!bid) return new NextResponse("Not found.", { status: 404 });

  const isVendor = session.user.roleAssignments.some(
    (ra) => ra.entityType === "VENDOR_COMPANY" && ra.entityId === bid.vendorCompanyId,
  );
  const isSocietyPostDeadline =
    bid.requirement.bidDeadline.getTime() <= Date.now() &&
    session.user.roleAssignments.some(
      (ra) => ra.entityType === "SOCIETY" && ra.entityId === bid.requirement.societyId,
    );
  if (!isVendor && !isSocietyPostDeadline) return new NextResponse("Not authorized.", { status: 403 });

  const pdf = await renderSubmittedBidPdf(id);
  if (!pdf) return new NextResponse("Not found.", { status: 404 });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="quote.pdf"`,
    },
  });
}
