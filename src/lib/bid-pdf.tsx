import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime } from "@/lib/date";
import { calcLineItemAmounts, calcQuoteTotals } from "@/lib/gst";

// Same visual language as work-order-pdf.tsx, extended with a two-column
// Supplier/Bill To header (standard Indian quote/invoice layout) and an
// optional GST column set.
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  titleRow: { marginBottom: 14 },
  docTitle: { fontSize: 20, fontWeight: 700, letterSpacing: 1 },
  quoteRef: { fontSize: 9, color: "#555555", marginTop: 2 },
  headerRow: { flexDirection: "row", marginBottom: 16, borderBottom: 1, borderBottomColor: "#cccccc", paddingBottom: 12 },
  headerCol: { flex: 1 },
  partyLabel: { fontSize: 9, fontWeight: 700, color: "#555555", marginBottom: 3, textTransform: "uppercase" },
  partyName: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  meta: { fontSize: 9, color: "#555555" },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6 },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: 120, color: "#555555" },
  value: { flex: 1 },
  table: { marginTop: 6, borderTop: 1, borderTopColor: "#dddddd" },
  tableRow: { flexDirection: "row", borderBottom: 1, borderBottomColor: "#eeeeee", paddingVertical: 4 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f5f5f5", paddingVertical: 4, fontWeight: 700 },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 1 },
  colRate: { flex: 1, textAlign: "right" },
  colAmount: { flex: 1, textAlign: "right" },
  colGstRate: { flex: 1, textAlign: "right" },
  colGstAmount: { flex: 1, textAlign: "right" },
  colLineTotal: { flex: 1, textAlign: "right" },
  totals: { marginTop: 8, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", width: 220, justifyContent: "space-between", marginTop: 2 },
  totalsLabel: { color: "#555555" },
  grandTotalRow: {
    flexDirection: "row",
    width: 220,
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 4,
    borderTop: 1,
    borderTopColor: "#dddddd",
    fontSize: 12,
    fontWeight: 700,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#999999",
    borderTop: 1,
    borderTopColor: "#eeeeee",
    paddingTop: 6,
  },
});

export interface BidPdfLineItem {
  description: string;
  quantity: string;
  unit: string;
  unitRate: string;
  amount: string;
  gstRate: string | null;
  gstAmount: string | null;
}

export interface BidPdfData {
  // Null for a not-yet-submitted preview — the underlying sequence number
  // doesn't exist until the Bid row is actually created.
  quoteReference: string | null;
  requirementName: string;
  categoryName: string;
  description: string;
  quoteDate: Date;
  bidValidity: Date;
  vendor: { name: string; address: string; phone: string; email: string };
  society: { name: string; address: string };
  gstCompliant: boolean;
  vendorGstNumber: string | null;
  societyGstNumber: string | null;
  lineItems: BidPdfLineItem[];
  subtotal: string;
  totalGst: string;
  grandTotal: string;
  paymentTerms: string | null;
  warrantyPeriod: string | null;
  completionTime: string | null;
  notes: string | null;
}

export function BidPdfDocument({ data }: { data: BidPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.titleRow}>
          <Text style={styles.docTitle}>QUOTATION</Text>
          <Text style={styles.quoteRef}>
            Quote No: {data.quoteReference ?? "Assigned on submission"}
          </Text>
        </View>

        <View style={styles.headerRow}>
          <View style={styles.headerCol}>
            <Text style={styles.partyLabel}>Supplier</Text>
            <Text style={styles.partyName}>{data.vendor.name}</Text>
            <Text style={styles.meta}>{data.vendor.address}</Text>
            <Text style={styles.meta}>
              {data.vendor.phone} · {data.vendor.email}
            </Text>
            {data.gstCompliant && data.vendorGstNumber && (
              <Text style={styles.meta}>GSTIN: {data.vendorGstNumber}</Text>
            )}
          </View>
          <View style={styles.headerCol}>
            <Text style={styles.partyLabel}>Bill To</Text>
            <Text style={styles.partyName}>{data.society.name}</Text>
            <Text style={styles.meta}>{data.society.address}</Text>
            {data.gstCompliant && data.societyGstNumber && (
              <Text style={styles.meta}>GSTIN: {data.societyGstNumber}</Text>
            )}
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Quote Date</Text>
          <Text style={styles.value}>{formatDate(data.quoteDate)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Quote Validity</Text>
          <Text style={styles.value}>{formatDate(data.bidValidity)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Requirement</Text>
          <Text>{data.categoryName}</Text>
          <Text style={styles.meta}>{data.description}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.colDesc}>Description</Text>
              <Text style={styles.colQty}>Qty</Text>
              <Text style={styles.colUnit}>Unit</Text>
              <Text style={styles.colRate}>Rate</Text>
              <Text style={styles.colAmount}>Amount</Text>
              {data.gstCompliant && <Text style={styles.colGstRate}>GST %</Text>}
              {data.gstCompliant && <Text style={styles.colGstAmount}>GST Amt</Text>}
              {data.gstCompliant && <Text style={styles.colLineTotal}>Line Total</Text>}
            </View>
            {data.lineItems.map((li, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.colDesc}>{li.description}</Text>
                <Text style={styles.colQty}>{li.quantity}</Text>
                <Text style={styles.colUnit}>{li.unit}</Text>
                <Text style={styles.colRate}>₹{li.unitRate}</Text>
                <Text style={styles.colAmount}>₹{li.amount}</Text>
                {data.gstCompliant && <Text style={styles.colGstRate}>{li.gstRate ?? "0"}%</Text>}
                {data.gstCompliant && <Text style={styles.colGstAmount}>₹{li.gstAmount ?? "0.00"}</Text>}
                {data.gstCompliant && (
                  <Text style={styles.colLineTotal}>
                    ₹{(Number(li.amount) + Number(li.gstAmount ?? 0)).toFixed(2)}
                  </Text>
                )}
              </View>
            ))}
          </View>
          <View style={styles.totals}>
            {data.gstCompliant ? (
              <>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Subtotal</Text>
                  <Text>₹{data.subtotal}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Total GST</Text>
                  <Text>₹{data.totalGst}</Text>
                </View>
                <View style={styles.grandTotalRow}>
                  <Text>Grand Total</Text>
                  <Text>₹{data.grandTotal}</Text>
                </View>
              </>
            ) : (
              <View style={styles.grandTotalRow}>
                <Text>Total</Text>
                <Text>₹{data.subtotal}</Text>
              </View>
            )}
          </View>
        </View>

        {(data.paymentTerms || data.warrantyPeriod || data.completionTime) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Terms</Text>
            {data.paymentTerms && (
              <View style={styles.row}>
                <Text style={styles.label}>Payment terms</Text>
                <Text style={styles.value}>{data.paymentTerms}</Text>
              </View>
            )}
            {data.warrantyPeriod && (
              <View style={styles.row}>
                <Text style={styles.label}>Warranty period</Text>
                <Text style={styles.value}>{data.warrantyPeriod}</Text>
              </View>
            )}
            {data.completionTime && (
              <View style={styles.row}>
                <Text style={styles.label}>Time to complete</Text>
                <Text style={styles.value}>{data.completionTime}</Text>
              </View>
            )}
          </View>
        )}

        {data.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes / Terms</Text>
            <Text style={styles.meta}>{data.notes}</Text>
          </View>
        )}

        {!data.gstCompliant && (
          <View style={styles.section}>
            <Text style={styles.meta}>GST, as applicable, is not included in this quote.</Text>
          </View>
        )}

        <Text style={styles.footer}>
          Generated on {formatDateTime(new Date())}. This is a quotation and not a tax invoice.
        </Text>
      </Page>
    </Document>
  );
}

// "Q26-000042" — 2-digit year + a globally unique, DB-assigned sequence
// (Bid.sequenceNumber), always exactly 10 characters. The year is cosmetic
// (readability/sorting) — uniqueness comes entirely from the sequence, so
// there's no reset-per-year race condition to worry about.
function quoteReference(sequenceNumber: number, date: Date): string {
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  return `Q${yy}-${String(sequenceNumber).padStart(6, "0")}`;
}

function toLineItemPdfData(li: {
  description: string;
  quantity: number | string;
  unit: string;
  unitRate: number | string;
  amount: number | string;
  gstRate: number | string | null;
  gstAmount: number | string | null;
}): BidPdfLineItem {
  return {
    description: li.description,
    quantity: Number(li.quantity).toString(),
    unit: li.unit,
    unitRate: Number(li.unitRate).toFixed(2),
    amount: Number(li.amount).toFixed(2),
    gstRate: li.gstRate !== null ? Number(li.gstRate).toString() : null,
    gstAmount: li.gstAmount !== null ? Number(li.gstAmount).toFixed(2) : null,
  };
}

/**
 * Renders the PDF for an already-submitted Bid — used by both the vendor's
 * own download and the society's post-deadline download, so they always see
 * byte-identical output. Name/address/phone/email are read live off the
 * VendorCompany/Society (not snapshotted — only the GST figures are, since
 * gstCompliant is a per-quote choice that shouldn't drift if the vendor
 * changes their default later).
 */
export async function renderSubmittedBidPdf(bidId: string): Promise<Buffer | null> {
  const bid = await prisma.bid.findUnique({
    where: { id: bidId },
    include: {
      lineItems: true,
      vendorCompany: { select: { name: true, registeredAddress: true, ownerPhone: true, ownerEmail: true } },
      requirement: {
        include: {
          categories: true,
          society: { select: { name: true, address: true } },
        },
      },
    },
  });
  if (!bid) return null;

  const lineItems = bid.lineItems.map((li) =>
    toLineItemPdfData({
      description: li.description,
      quantity: Number(li.quantity),
      unit: li.unit,
      unitRate: Number(li.unitRate),
      amount: Number(li.amount),
      gstRate: li.gstRate !== null ? Number(li.gstRate) : null,
      gstAmount: li.gstAmount !== null ? Number(li.gstAmount) : null,
    }),
  );
  const totals = calcQuoteTotals(
    bid.lineItems.map((li) => ({ amount: Number(li.amount), gstAmount: li.gstAmount ? Number(li.gstAmount) : null })),
  );

  const data: BidPdfData = {
    quoteReference: quoteReference(bid.sequenceNumber, bid.createdAt),
    requirementName: bid.requirement.name,
    categoryName: bid.requirement.categories.map((c) => c.name).join(", "),
    description: bid.requirement.description,
    quoteDate: bid.createdAt,
    bidValidity: bid.bidValidity,
    vendor: {
      name: bid.vendorCompany.name,
      address: bid.vendorCompany.registeredAddress,
      phone: bid.vendorCompany.ownerPhone,
      email: bid.vendorCompany.ownerEmail,
    },
    society: { name: bid.requirement.society.name, address: bid.requirement.society.address },
    gstCompliant: bid.gstCompliant,
    vendorGstNumber: bid.vendorGstNumberSnapshot,
    societyGstNumber: bid.societyGstNumberSnapshot,
    lineItems,
    subtotal: totals.subtotal.toFixed(2),
    totalGst: totals.totalGst.toFixed(2),
    grandTotal: totals.grandTotal.toFixed(2),
    paymentTerms: bid.paymentTerms,
    warrantyPeriod: bid.warrantyPeriod,
    completionTime: bid.completionTime,
    notes: bid.notes,
  };

  return renderToBuffer(<BidPdfDocument data={data} />);
}

export interface BidPdfPreviewLineItemInput {
  description: string;
  quantity: number;
  unit: string;
  unitRate: number;
  gstRate: number | null;
}

/**
 * Renders a preview PDF from live, not-yet-submitted form state — same
 * document component as the real thing, so what a vendor previews is
 * exactly what they'll get after submitting (module reused deliberately,
 * not just visually similar markup).
 */
export async function renderBidPdfPreview(input: {
  vendorCompanyId: string;
  requirementId: string;
  bidValidity: Date;
  gstCompliant: boolean;
  vendorGstNumber: string | null;
  lineItems: BidPdfPreviewLineItemInput[];
  paymentTerms: string | null;
  warrantyPeriod: string | null;
  completionTime: string | null;
  notes: string | null;
}): Promise<Buffer | null> {
  const [vendorCompany, requirement] = await Promise.all([
    prisma.vendorCompany.findUnique({
      where: { id: input.vendorCompanyId },
      select: { name: true, registeredAddress: true, ownerPhone: true, ownerEmail: true },
    }),
    prisma.requirement.findUnique({
      where: { id: input.requirementId },
      include: { categories: true, society: { select: { name: true, address: true, gstNumber: true } } },
    }),
  ]);
  if (!vendorCompany || !requirement) return null;

  const computedLines = input.lineItems.map((li) => {
    const { amount, gstAmount } = calcLineItemAmounts({
      quantity: li.quantity,
      unitRate: li.unitRate,
      gstRate: input.gstCompliant ? li.gstRate : null,
    });
    return { ...li, amount, gstAmount };
  });
  const totals = calcQuoteTotals(computedLines);

  const data: BidPdfData = {
    quoteReference: null,
    requirementName: requirement.name,
    categoryName: requirement.categories.map((c) => c.name).join(", "),
    description: requirement.description,
    quoteDate: new Date(),
    bidValidity: input.bidValidity,
    vendor: {
      name: vendorCompany.name,
      address: vendorCompany.registeredAddress,
      phone: vendorCompany.ownerPhone,
      email: vendorCompany.ownerEmail,
    },
    society: { name: requirement.society.name, address: requirement.society.address },
    gstCompliant: input.gstCompliant,
    vendorGstNumber: input.vendorGstNumber,
    societyGstNumber: requirement.society.gstNumber,
    lineItems: computedLines.map((li) =>
      toLineItemPdfData({
        description: li.description,
        quantity: li.quantity,
        unit: li.unit,
        unitRate: li.unitRate,
        amount: li.amount,
        gstRate: input.gstCompliant ? li.gstRate : null,
        gstAmount: li.gstAmount,
      }),
    ),
    subtotal: totals.subtotal.toFixed(2),
    totalGst: totals.totalGst.toFixed(2),
    grandTotal: totals.grandTotal.toFixed(2),
    paymentTerms: input.paymentTerms,
    warrantyPeriod: input.warrantyPeriod,
    completionTime: input.completionTime,
    notes: input.notes,
  };

  return renderToBuffer(<BidPdfDocument data={data} />);
}
