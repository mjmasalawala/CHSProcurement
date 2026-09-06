import { isStagingEnvironment } from "@/lib/environment";

// Maps a Message.templateKey to the approved Meta WhatsApp template that
// reaches that contact when their 24h session window is closed (i.e. first
// contact, or any time they haven't messaged us recently) — see
// dispatcher.ts. OTP has its own dedicated send path (sendWhatsappOtp) and
// isn't part of this registry.
//
// Environment-aware (2026-09-06, product decision): staging always runs
// against a separate Test WABA, production against the real one — Meta
// template approvals don't transfer between WABAs, and its classifier
// isn't fully deterministic (the same content submitted twice has landed
// in different categories before), so the *name* — and even whether a
// template exists there at all — can legitimately differ per WABA for the
// same logical message. `test` is populated as soon as a wording is
// approved there; `production` is only added once that exact working
// version has been mirrored and approved on the real WABA — never submit
// to production until testing settles on a final version (a rejected/
// reclassified draft has no business cluttering the real number's
// template history). A templateKey with no entry for the active
// environment is treated by getWhatsappTemplate below as "not ready
// there" and the dispatcher SKIPs with a clear reason, rather than
// guessing or falling back to the other environment's template.
//
// Keep this in sync with what's actually approved on each WABA — check via
// GET /{WABA_ID}/message_templates before assuming an entry here will send.
interface TemplateRef {
  name: string;
  language: string;
}

interface TemplateByEnvironment {
  test: TemplateRef;
  production?: TemplateRef;
}

const WHATSAPP_TEMPLATES: Record<string, TemplateByEnvironment> = {
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
  // History (all confirmed via real submissions, 2026-09-05, all on the
  // Test WABA at the time — the two-WABA split wasn't discovered until
  // 2026-09-06): v1 (wisesoc_vendor_suggested) used a *dynamic* register-
  // link button and got reclassified MARKETING; v2
  // (wisesoc_vendor_suggested_v2) dropped buttons entirely for a body-
  // embedded link and STILL got reclassified MARKETING on final review
  // despite showing UTILITY at submission — Meta's policy apparently
  // treats "come register on our platform" content as inherently
  // promotional regardless of wording or buttons. v3 accepts that and is
  // submitted straight as MARKETING. v1/v2 are left orphaned/unused (Meta
  // template deletion needs a permission our token doesn't have).
  "vendor.suggested": {
    test: { name: "wisesoc_vendor_suggested_v3", language: "en" },
    // Mirrored to the production WABA (4358290911100089, "Wisesoc")
    // 2026-09-06, using the identical body/buttons/category confirmed live
    // on the test WABA — approved there as MARKETING too, same as test.
    production: { name: "wisesoc_vendor_suggested_v3", language: "en" },
  },

  // Generic role invite — Manager/Chairman/Secretary/Treasurer, Vendor
  // Staff — from lib/notifications.ts's sendInvite (non-registrationPitch
  // path only). Body: "You've been given {{1}} access for {{2}} on
  // Wisesoc by {{3}}. Tap below within 24 hours to get started — the link
  // expires after that." ({{1}}=role, {{2}}=entityName, {{3}}=inviterName).
  // One dynamic URL button, "Create your password" →
  // https://www.wisesoc.in/invite/{{1}}, where {{1}} is the raw invite
  // token — see Message.whatsappButtonParam / sendWhatsappTemplate's
  // buttonParam.
  //
  // History: submitted as UTILITY (v1 body mentioned "password"/"activate"
  // and got rejected INCORRECT_CATEGORY, same failure mode as the actual
  // OTP template — Meta's classifier reads that phrasing as
  // authentication-adjacent); v2 dropped that language, submission
  // succeeded but was reclassified MARKETING on final review anyway, same
  // outcome as vendor.suggested. Only submitted on the Test WABA so far —
  // mirror to production once this is confirmed working end to end.
  "invite.role_activation": {
    test: { name: "wisesoc_role_invite_v2", language: "en" },
  },
};

/**
 * Looks up templateKey against whichever WABA the current environment
 * actually talks to (test in staging, production in production — see
 * lib/environment.ts's isStagingEnvironment, the same check that drives
 * every other test/prod-specific behavior in this app). Returns undefined
 * if this templateKey has no approved template on that WABA yet.
 */
export function getWhatsappTemplate(templateKey: string): TemplateRef | undefined {
  const entry = WHATSAPP_TEMPLATES[templateKey];
  if (!entry) return undefined;
  return isStagingEnvironment() ? entry.test : entry.production;
}
