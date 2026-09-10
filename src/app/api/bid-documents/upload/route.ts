import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyActionPermission } from "@/lib/society-auth";
import { requireVendorActionPermission } from "@/lib/vendor-auth";
import { MAX_BID_DOCUMENT_BYTES, BID_DOCUMENT_CONTENT_TYPES } from "@/lib/bid-documents";

// clientPayload is a JSON-encoded discriminated union rather than a bare id
// — this one client-token endpoint serves both upload surfaces for the same
// document-to-bid pipeline: the Manager's "Upload quote on behalf" (society/
// [id]/requirements/[reqId]/upload-bid-panel.tsx) and the vendor's own
// "Upload a quote document" shortcut on their bid form (vendor/[id]/
// requirements/[reqId]/bid-form.tsx). Each is checked against the same
// permission its real bid-creation server action enforces.
type ClientPayload = { actor: "society"; societyId: string } | { actor: "vendor"; vendorCompanyId: string };

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!clientPayload) throw new Error("Missing clientPayload.");
        const payload = JSON.parse(clientPayload) as ClientPayload;

        if (payload.actor === "society") {
          await requireSocietyActionPermission(payload.societyId, PERMISSIONS.UPLOAD_BID_ON_BEHALF);
        } else {
          await requireVendorActionPermission(payload.vendorCompanyId, PERMISSIONS.SUBMIT_BID, {
            requireActiveVendor: true,
          });
        }

        return {
          allowedContentTypes: [...BID_DOCUMENT_CONTENT_TYPES],
          maximumSizeInBytes: MAX_BID_DOCUMENT_BYTES,
          addRandomSuffix: true,
        };
      },
      // No onUploadCompleted — the uploaded file's URL is read back by the
      // extractBidDocument server action, called directly by the client once
      // the upload resolves (same reasoning as requirement-photos/upload:
      // no public callback URL on localhost, and nothing here needs to be
      // written until the caller actually confirms the parsed bid).
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("bid-documents upload token generation failed:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
