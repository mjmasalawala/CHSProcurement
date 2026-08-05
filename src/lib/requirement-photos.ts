// Society requirement-creation wizard — optional photos, stored in Vercel
// Blob and referenced by URL from Requirement.attachmentUrls (society-side
// brainstorm, 2026-07-29). Vendor-side visibility is gated on the same
// contactRevealedAt flag as the society's contact details, since photos can
// reveal the building/society identity just as easily as an address can.
export const MAX_REQUIREMENT_PHOTOS = 5;
export const MAX_REQUIREMENT_PHOTO_BYTES = 3 * 1024 * 1024;

// iPhone camera capture can arrive as HEIC — allowed here so the upload
// itself never rejects it, even though not every browser can render it
// inline (see bid-form's photos step for the user-facing heads-up).
export const REQUIREMENT_PHOTO_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
