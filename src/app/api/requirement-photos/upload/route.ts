import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyActionPermission } from "@/lib/society-auth";
import { MAX_REQUIREMENT_PHOTO_BYTES, REQUIREMENT_PHOTO_CONTENT_TYPES } from "@/lib/requirement-photos";

// Client-token endpoint for the requirement-photos wizard step
// (src/app/society/[id]/requirements/new/wizard.tsx). The requirement
// doesn't exist yet at upload time, so the client authorizes itself by
// societyId (via clientPayload) rather than a requirementId — the same
// CREATE_REQUIREMENT permission createRequirement itself enforces.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const societyId = clientPayload;
        if (!societyId) throw new Error("Missing societyId.");
        await requireSocietyActionPermission(societyId, PERMISSIONS.CREATE_REQUIREMENT);

        return {
          allowedContentTypes: REQUIREMENT_PHOTO_CONTENT_TYPES,
          maximumSizeInBytes: MAX_REQUIREMENT_PHOTO_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
