// Manager-upload-a-vendor-quote feature — drag-and-drop a PDF/image/Excel
// file onto an invited vendor's row, parsed via Claude (lib/ai.ts
// extractBidFromDocument) into draft Bid line items for the Manager to
// review before submitting. Mirrors requirement-photos.ts's pattern for its
// own upload surface.
export const MAX_BID_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const BID_DOCUMENT_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
] as const;

export type BidDocumentContentType = (typeof BID_DOCUMENT_CONTENT_TYPES)[number];

export const SPREADSHEET_CONTENT_TYPES: BidDocumentContentType[] = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];
