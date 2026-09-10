import ExcelJS from "exceljs";

/**
 * Renders every sheet of a vendor-uploaded .xlsx/.xls quote as a plain-text
 * table (tab-separated rows, one block per sheet) so it can go into a Claude
 * text prompt the same way a PDF/image goes in as a document/image block —
 * see lib/ai.ts extractBidFromDocument. Reads each cell's already-computed
 * `.result` when it's a formula (never evaluates formulas itself) so a
 * malicious workbook can't trigger anything beyond a normal parse.
 */
export async function spreadsheetToText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  // exceljs bundles its own @types/node internally, which disagrees with the
  // project's about Buffer's exact shape — same runtime object either way,
  // so this cast is purely to satisfy the type-level mismatch between them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const sheets: string[] = [];
  workbook.eachSheet((sheet) => {
    const rows: string[] = [];
    sheet.eachRow((row) => {
      const cells = (row.values as unknown[]).slice(1).map((v) => cellToText(v));
      if (cells.some((c) => c.trim())) rows.push(cells.join("\t"));
    });
    if (rows.length) sheets.push(`--- Sheet: ${sheet.name} ---\n${rows.join("\n")}`);
  });

  return sheets.join("\n\n");
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("result" in (value as Record<string, unknown>)) return cellToText((value as { result: unknown }).result);
    if ("text" in (value as Record<string, unknown>)) return String((value as { text: unknown }).text);
    if ("richText" in (value as Record<string, unknown>)) {
      return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
    }
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return String(value);
}
