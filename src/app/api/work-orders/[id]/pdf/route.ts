import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderWorkOrderPdf } from "@/lib/work-order-pdf";

// work-order-pdf-spec.md Section 4 — downloadable from both the Society
// (Requirement/Archive detail) and Vendor (My Bids, once won) sides. Gated
// to a role assignment on either the issuing society or the winning vendor
// company — nobody else can fetch a Work Order by guessing its id.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session) return new NextResponse("Not authorized.", { status: 401 });

  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    select: { requirement: { select: { societyId: true } }, bid: { select: { vendorCompanyId: true } } },
  });
  if (!workOrder) return new NextResponse("Not found.", { status: 404 });

  const allowed = session.user.roleAssignments.some(
    (ra) =>
      (ra.entityType === "SOCIETY" && ra.entityId === workOrder.requirement.societyId) ||
      (ra.entityType === "VENDOR_COMPANY" && ra.entityId === workOrder.bid.vendorCompanyId),
  );
  if (!allowed) return new NextResponse("Not authorized.", { status: 403 });

  const pdf = await renderWorkOrderPdf(id);
  if (!pdf) return new NextResponse("Not found.", { status: 404 });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="work-order.pdf"`,
    },
  });
}
