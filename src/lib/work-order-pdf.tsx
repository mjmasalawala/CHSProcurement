import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";

// work-order-pdf-spec.md Section 5 — dark-on-light, matches the platform's
// typography intent without pulling in the actual Tailwind/CSS tokens
// (react-pdf uses its own layout engine, not real CSS).
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { marginBottom: 16, borderBottom: 1, borderBottomColor: "#cccccc", paddingBottom: 12 },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
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
  total: { marginTop: 8, textAlign: "right", fontSize: 12, fontWeight: 700 },
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

interface WorkOrderPdfData {
  workOrderNumber: string;
  createdAt: Date;
  societyNameSnapshot: string;
  societyAddressSnapshot: string;
  vendorNameSnapshot: string;
  vendorAddressSnapshot: string;
  vendorContactSnapshot: string;
  approvalSummary: string;
  justificationNote: string | null;
  requirementId: string;
  categoryName: string;
  description: string;
  bidValidity: Date;
  notes: string | null;
  lineItems: { description: string; quantity: string; unit: string; unitRate: string; amount: string }[];
  totalAmount: string;
}

function WorkOrderDocument({ data }: { data: WorkOrderPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{data.societyNameSnapshot}</Text>
          <Text style={styles.meta}>{data.societyAddressSnapshot}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Work Order No.</Text>
          <Text style={styles.value}>{data.workOrderNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date Issued</Text>
          <Text style={styles.value}>{data.createdAt.toLocaleDateString()}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Addressed to</Text>
          <Text>{data.vendorNameSnapshot}</Text>
          <Text style={styles.meta}>{data.vendorAddressSnapshot}</Text>
          <Text style={styles.meta}>{data.vendorContactSnapshot}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reference</Text>
          <Text>
            {data.categoryName} — Requirement {data.requirementId}
          </Text>
          <Text style={styles.meta}>{data.description}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scope of work</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.colDesc}>Description</Text>
              <Text style={styles.colQty}>Qty</Text>
              <Text style={styles.colUnit}>Unit</Text>
              <Text style={styles.colRate}>Rate</Text>
              <Text style={styles.colAmount}>Amount</Text>
            </View>
            {data.lineItems.map((li, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.colDesc}>{li.description}</Text>
                <Text style={styles.colQty}>{li.quantity}</Text>
                <Text style={styles.colUnit}>{li.unit}</Text>
                <Text style={styles.colRate}>₹{li.unitRate}</Text>
                <Text style={styles.colAmount}>₹{li.amount}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.total}>Total: ₹{data.totalAmount}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Approval</Text>
          <Text>{data.approvalSummary}</Text>
          {data.justificationNote && (
            <Text style={styles.meta}>Justification: {data.justificationNote}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bid validity</Text>
          <Text>{data.bidValidity.toLocaleDateString()}</Text>
        </View>

        {data.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vendor notes / terms</Text>
            <Text style={styles.meta}>{data.notes}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          Generated by ProSoc on {new Date().toLocaleString()}. This Work Order is issued as of the date
          above; society and vendor details reflect their state at the time of finalization.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderWorkOrderPdf(workOrderId: string): Promise<Buffer | null> {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      requirement: { include: { category: true } },
      bid: { include: { lineItems: true } },
    },
  });
  if (!workOrder) return null;

  const data: WorkOrderPdfData = {
    workOrderNumber: workOrder.workOrderNumber,
    createdAt: workOrder.createdAt,
    societyNameSnapshot: workOrder.societyNameSnapshot,
    societyAddressSnapshot: workOrder.societyAddressSnapshot,
    vendorNameSnapshot: workOrder.vendorNameSnapshot,
    vendorAddressSnapshot: workOrder.vendorAddressSnapshot,
    vendorContactSnapshot: workOrder.vendorContactSnapshot,
    approvalSummary: workOrder.approvalSummary,
    justificationNote: workOrder.justificationNote,
    requirementId: workOrder.requirementId,
    categoryName: workOrder.requirement.category.name,
    description: workOrder.requirement.description,
    bidValidity: workOrder.bid.bidValidity,
    notes: workOrder.bid.notes,
    lineItems: workOrder.bid.lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity.toString(),
      unit: li.unit,
      unitRate: li.unitRate.toString(),
      amount: li.amount.toString(),
    })),
    totalAmount: workOrder.bid.totalAmount.toString(),
  };

  return renderToBuffer(<WorkOrderDocument data={data} />);
}
