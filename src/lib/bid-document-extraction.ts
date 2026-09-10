import { extractBidFromDocument, type ExtractedBid } from "@/lib/ai";
import { spreadsheetToText } from "@/lib/spreadsheet-text";
import { SPREADSHEET_CONTENT_TYPES, type BidDocumentContentType } from "@/lib/bid-documents";

const IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/**
 * Downloads an already-uploaded quote document and routes it through Claude
 * (lib/ai.ts extractBidFromDocument) — shared by both upload surfaces on the
 * same document-to-bid pipeline: the Manager's upload-on-behalf action
 * (society/[id]/requirements/[reqId]/actions.ts) and the vendor's own
 * "upload a document instead" shortcut (vendor/[id]/requirements/[reqId]/
 * actions.ts). Callers are responsible for their own permission/invite
 * checks before calling this — it does no authorization itself.
 */
export async function extractBidFromUploadedDocument(
  documentUrl: string,
  contentType: string,
): Promise<{ extracted: ExtractedBid } | { error: string }> {
  try {
    const res = await fetch(documentUrl);
    if (!res.ok) throw new Error(`Fetch failed with ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());

    if (SPREADSHEET_CONTENT_TYPES.includes(contentType as BidDocumentContentType)) {
      const text = await spreadsheetToText(buffer);
      if (!text.trim()) return { error: "Couldn't find any data in that spreadsheet." };
      return { extracted: await extractBidFromDocument({ kind: "text", text }) };
    }

    if (contentType === "application/pdf") {
      return { extracted: await extractBidFromDocument({ kind: "pdf", base64: buffer.toString("base64") }) };
    }

    if ((IMAGE_MEDIA_TYPES as readonly string[]).includes(contentType)) {
      return {
        extracted: await extractBidFromDocument({
          kind: "image",
          base64: buffer.toString("base64"),
          mediaType: contentType as (typeof IMAGE_MEDIA_TYPES)[number],
        }),
      };
    }

    return { error: "Unsupported file type." };
  } catch (err) {
    console.error(`Failed to extract bid document from ${documentUrl}:`, err);
    return { error: "Couldn't read that document — please check the file and try again, or enter the quote manually." };
  }
}
