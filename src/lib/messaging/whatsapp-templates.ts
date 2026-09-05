// Maps a Message.templateKey to the approved Meta WhatsApp template that
// reaches that contact when their 24h session window is closed (i.e. first
// contact, or any time they haven't messaged us recently) — see
// dispatcher.ts. One entry per templateKey that has an actual approved
// WhatsApp template; anything missing here just gets SKIPPED with a clear
// reason until it's added. OTP has its own dedicated send path
// (sendWhatsappOtp) and isn't part of this registry.
//
// Keep this in sync with what's actually approved on the WABA — check via
// GET /{WABA_ID}/message_templates before assuming an entry here will send.
export const WHATSAPP_TEMPLATES: Record<string, { name: string; language: string }> = {
  // Society "Suggest a Vendor" (lib/notifications.ts's notifyVendorSuggested)
  // — body: "Hello {{1}} — {{2}} from {{3}} has suggested you register as a
  // vendor so that they can send their requirements to you in an automated
  // way on WhatsApp. Housing societies use Wisesoc to find and hire vendors
  // like you." ({{1}}=vendorName, {{2}}=suggestedByName, {{3}}=societyName).
  // Two static (non-personalized) URL buttons: "Register on Wisesoc" →
  // https://www.wisesoc.in/vendors, "Know More" →
  // https://www.wisesoc.in/faq/vendors — neither needs a send-time
  // parameter since both are fixed links, not per-vendor ones.
  //
  // History (all confirmed via real submissions, 2026-09-05): v1
  // (wisesoc_vendor_suggested) used a *dynamic* register-link button and
  // got reclassified MARKETING; v2 (wisesoc_vendor_suggested_v2) dropped
  // buttons entirely for a body-embedded link and STILL got reclassified
  // MARKETING on final review despite showing UTILITY at submission —
  // Meta's policy apparently treats "come register on our platform"
  // content as inherently promotional regardless of wording or buttons.
  // v3 accepts that and is submitted straight as MARKETING. v1/v2 are left
  // orphaned/unused (Meta template deletion needs a permission our token
  // doesn't have).
  "vendor.suggested": { name: "wisesoc_vendor_suggested_v3", language: "en" },
};
