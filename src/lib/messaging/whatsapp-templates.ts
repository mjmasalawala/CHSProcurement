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
  // — body: "Wisesoc: {{2}} from {{3}} has suggested you register as a
  // vendor. Housing societies use Wisesoc to find and hire vendors like
  // {{1}}. Register here: {{4}} — it only takes a few minutes."
  // Submitted 2026-09-05, UTILITY category, pending Meta review as of then.
  "vendor.suggested": { name: "wisesoc_vendor_suggested", language: "en" },
};
