// Standard 15-character GSTIN shape: 2-digit state code, 10-char PAN,
// 1-digit entity code, literal "Z", 1 checksum char — pragmatic format
// check, not a checksum/state-code lookup.
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGstin(value: string): boolean {
  return GSTIN_REGEX.test(value.trim().toUpperCase());
}

export interface LineItemGstInput {
  quantity: number;
  unitRate: number;
  gstRate: number | null;
}

export function calcLineItemAmounts(input: LineItemGstInput): { amount: number; gstAmount: number | null } {
  const amount = input.quantity * input.unitRate;
  const gstAmount = input.gstRate !== null ? amount * (input.gstRate / 100) : null;
  return { amount, gstAmount };
}

export function calcQuoteTotals(lines: { amount: number; gstAmount: number | null }[]): {
  subtotal: number;
  totalGst: number;
  grandTotal: number;
} {
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const totalGst = lines.reduce((sum, l) => sum + (l.gstAmount ?? 0), 0);
  return { subtotal, totalGst, grandTotal: subtotal + totalGst };
}
