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
  // path only). Body: "Congrats. You've been given {{1}} access for {{2}}
  // on Wisesoc by {{3}}. Use the link below to create your profile and
  // sign-in." ({{1}}=role, {{2}}=entityName, {{3}}=inviterName). One
  // dynamic URL button, "Create your password" →
  // https://www.wisesoc.in/invite/{{1}}, where {{1}} is the raw invite
  // token — see Message.whatsappButtonParam / sendWhatsappTemplate's
  // buttonParam.
  //
  // History: v1 body mentioned "password"/"activate" and got rejected
  // INCORRECT_CATEGORY, same failure mode as the actual OTP template
  // (Meta's classifier reads that phrasing as authentication-adjacent); v2
  // dropped that language and got approved but reclassified MARKETING on
  // final review; v3 (this one) reworded again ("Congrats...") and STILL
  // landed MARKETING despite showing UTILITY through most of review —
  // three separate templates (this one plus vendor.suggested's two) all
  // converging on MARKETING regardless of wording strongly suggests Meta's
  // policy treats "you've been granted access, click to activate" content
  // as inherently promotional on this account — not worth further wording
  // attempts chasing UTILITY. v1/v2 left orphaned/unused.
  //
  // Mirrored to the production WABA (4358290911100089, "Wisesoc")
  // 2026-09-06, identical content, approved there as MARKETING too.
  "invite.role_activation": {
    test: { name: "wisesoc_role_invite_v3", language: "en" },
    production: { name: "wisesoc_role_invite_v3", language: "en" },
  },

  // Admin approves a vendor's registration (admin/vendors/[id]/actions.ts's
  // approveVendor). Body: "Great news — your Wisesoc registration for
  // {{1}} has been approved. *Next step*: complete your profile with more
  // details so we can match you accurately with requirements on the
  // portal from societies." ({{1}}=VendorCompany.name). One dynamic URL
  // button, "Update Profile" → https://www.wisesoc.in/vendor-profile/{{1}},
  // {{1}}=VendorCompany.id — routes through the /vendor-profile/[id]
  // redirect (see that route for why: Meta only allows a dynamic button's
  // variable as a bare trailing suffix, and /vendor/{id}/profile has
  // /profile after the id).
  //
  // Submitted 2026-09-07 to the Test WABA as UTILITY (servicing an
  // existing, already-registered vendor's account — distinct in kind from
  // vendor.suggested/invite.role_activation, which both target someone
  // with no prior relationship and got reclassified MARKETING regardless
  // of wording) — and it held: the first template in this project to be
  // approved as UTILITY rather than reclassified. Mirrored to the
  // production WABA (4358290911100089, "Wisesoc") 2026-09-07, identical
  // content, also approved there as UTILITY.
  "vendor.approved": {
    test: { name: "wisesoc_vendor_approved_v1", language: "en" },
    production: { name: "wisesoc_vendor_approved_v1", language: "en" },
  },

  // Requirement matched to an already-active vendor (two trigger paths:
  // notifyRequirementMatched — a new requirement just matched vendors —
  // and notifyVendorMatchedRequirements — a vendor became newly eligible
  // for existing open requirements, one WhatsApp send per requirement per
  // 2026-09-07 product decision, even though the email side stays one
  // batch summary). Params: {{1}}=requirement title, {{2}}=category name,
  // {{3}}=vendor company name, {{4}}=bid deadline formatted DD-MMM-YY HH:MM
  // via lib/date.ts's formatWhatsappDeadline. One static URL button,
  // "Login to Wisesoc" → https://www.wisesoc.in/login (no variable —
  // deliberately a plain login page, not a deep link, per product
  // decision).
  //
  // History: v1 ("Requirement - "{{1}}" in {{2}} category has been
  // matched for {{3}}. Log in to your Wisesoc account by {{4}} and submit
  // your quote.") was submitted UTILITY and reclassified MARKETING on
  // both WABAs. v2 ("Update on your Wisesoc profile: requirement "{{1}}"
  // in {{2}} category matched for {{3}}. Quote submission deadline:
  // {{4}} (IST).") reworded to lean into "status update on your existing
  // profile" framing and drop the "log in and act now" instruction, in
  // case the CTA phrasing itself was the trigger — also reclassified
  // MARKETING regardless, on both WABAs. Together with vendor.approved
  // landing UTILITY on the first try with no such struggle, this is good
  // evidence the deciding factor here isn't wording at all: "a new
  // business opportunity has appeared for you to act on" reads to Meta's
  // classifier as fundamentally the same shape as vendor.suggested/
  // invite.role_activation (new-opportunity/engagement content), no
  // matter how the sentence is built — unlike vendor.approved's pure
  // account-status-update content, which isn't "new" in that sense at
  // all. Accepted as MARKETING going forward (2026-09-07 product
  // decision) — v1 left orphaned/unused, same as prior superseded drafts.
  "requirement.matched": {
    test: { name: "wisesoc_requirement_matched_v2", language: "en" },
    production: { name: "wisesoc_requirement_matched_v2", language: "en" },
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
