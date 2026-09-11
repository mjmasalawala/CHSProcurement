import { getBaseUrl } from "@/lib/base-url";
import { enqueueEmail, enqueueWhatsapp } from "@/lib/messaging/outbox";
import { sendOne } from "@/lib/messaging/dispatcher";
import { toE164India } from "@/lib/phone";
import { formatWhatsappDeadline, formatDateTime } from "@/lib/date";
import type { MessageCategory } from "@/generated/prisma/enums";
// SMS notifications are disabled for now — MSG91 is wired up for phone-
// verification OTPs only (lib/phone-verification.ts), since sending
// anything else requires a separately DLT-registered template per message
// (product decision, 2026-07-19). Every sendSms(...) call below is commented
// out, not deleted, so re-enabling a given notification once its template is
// approved is a one-line uncomment. Re-import when the first one comes back:
// import { sendSms } from "@/lib/sms";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface EmailLink {
  label: string;
  url: string;
}

interface EmailStep {
  label: string;
  description: string;
  url: string;
  linkLabel: string;
}

interface EmailContent {
  to: string | string[];
  subject: string;
  heading: string;
  // Each entry becomes its own paragraph (text: blank-line separated, html: <p>).
  paragraphs: string[];
  // A bulleted list rendered after the paragraphs, before the CTA.
  list?: string[];
  // The one prominent, button-styled action for this email.
  cta?: EmailLink;
  // A shaded "Next steps" checklist rendered after the CTA — for an email
  // with more than one follow-up action to offer (e.g. vendor approval:
  // complete your profile, invite your team), where a single CTA button
  // isn't enough and stacking multiple buttons would look like button soup.
  steps?: EmailStep[];
  // Smaller "Click here for…" links below the CTA — e.g. an FAQ page.
  secondaryLinks?: EmailLink[];
  // Small print at the very bottom (expiry notes, etc).
  footer?: string;
  // Outbox metadata (Requirements/messaging-and-engagement-spec.md, Phase
  // 0) — a stable identifier per notification type, matching the message
  // catalog in the spec doc, so every email is logged individually and
  // (Phase 1+) becomes the same key its WhatsApp template equivalent uses.
  templateKey: string;
  // TRANSACTIONAL (default) and REMINDER are always sent; MARKETING is the
  // only category ContactPreference.emailMarketingOptOutAt can suppress.
  category?: MessageCategory;
  // For a reminder that a cron route may attempt to (re-)enqueue more than
  // once for the same event (e.g. a retry after a prior run crashed before
  // recording that this one went out) — enqueueEmail's unique constraint on
  // this makes the second attempt a silent no-op instead of a duplicate
  // send, independent of whatever flag the caller uses to track "already
  // notified".
  dedupeKey?: string;
}

/**
 * Shared card-style HTML template for every outbound email — replaces the
 * plain-text-only emails the app used to send. Inline styles throughout
 * since email clients don't reliably apply <style> blocks. User-supplied
 * strings (names, society names, custom messages) are escaped since they're
 * interpolated into HTML.
 */
function renderEmailHtml(content: EmailContent): string {
  const paragraphsHtml = content.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#2d2d2d;">${escapeHtml(p)}</p>`)
    .join("");

  const listHtml = content.list
    ? `<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.7;color:#2d2d2d;">${content.list
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("")}</ul>`
    : "";

  const ctaHtml = content.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
        <tr><td style="border-radius:8px;background-color:#b73c01;">
          <a href="${content.cta.url}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(
            content.cta.label,
          )}</a>
        </td></tr>
      </table>`
    : "";

  const stepsHtml = content.steps?.length
    ? `<div style="margin:0 0 20px;padding:18px 20px;background-color:#f9f6f3;border:1px solid #f0e6dd;border-radius:10px;">
        <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#0a1a30;text-transform:uppercase;letter-spacing:0.05em;">Next steps</p>
        ${content.steps
          .map(
            (s, i) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="${
              i < content.steps!.length - 1 ? "margin:0 0 14px;" : "margin:0;"
            }">
          <tr><td style="vertical-align:top;">
            <p style="margin:0;font-size:14px;font-weight:600;color:#1f1f1f;">${i + 1}. ${escapeHtml(s.label)}</p>
            <p style="margin:2px 0 6px;font-size:13px;line-height:1.5;color:#5a5a5a;">${escapeHtml(s.description)}</p>
            <a href="${s.url}" style="font-size:13px;font-weight:600;color:#b73c01;text-decoration:none;">${escapeHtml(s.linkLabel)}</a>
          </td></tr>
        </table>`,
          )
          .join("")}
      </div>`
    : "";

  const secondaryLinksHtml = content.secondaryLinks?.length
    ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;">${content.secondaryLinks
        .map((l) => `<a href="${l.url}" style="color:#b73c01;text-decoration:underline;">Click here for ${escapeHtml(l.label)}</a>`)
        .join(" &nbsp;·&nbsp; ")}</p>`
    : "";

  const footerHtml = content.footer
    ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#8a8a8a;">${escapeHtml(content.footer)}</p>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background-color:#f4f4f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8e6e1;">
      <tr><td style="padding:24px 32px;text-align:center;background-color:#ffffff;border-bottom:1px solid #e8e6e1;">
        <img src="${getBaseUrl()}/logo-full.png" alt="Wisesoc" height="35" style="height:35px;width:auto;display:inline-block;border:0;" />
      </td></tr>
      <tr><td style="padding:28px 32px 32px;">
        <h1 style="margin:0 0 16px;font-size:19px;font-weight:700;color:#1f1f1f;">${escapeHtml(content.heading)}</h1>
        ${paragraphsHtml}
        ${listHtml}
        ${ctaHtml}
        ${stepsHtml}
        ${secondaryLinksHtml}
        ${footerHtml}
      </td></tr>
    </table>
  </body>
</html>`;
}

function renderEmailText(content: EmailContent): string {
  const lines = [content.heading, "", ...content.paragraphs.flatMap((p) => [p, ""])];
  if (content.list) {
    lines.push(...content.list.map((item) => `- ${item}`), "");
  }
  if (content.cta) {
    lines.push(`${content.cta.label}: ${content.cta.url}`, "");
  }
  if (content.steps?.length) {
    lines.push(
      "Next steps:",
      ...content.steps.flatMap((s, i) => [`${i + 1}. ${s.label} — ${s.description}`, `${s.linkLabel}: ${s.url}`, ""]),
    );
  }
  if (content.secondaryLinks?.length) {
    lines.push(...content.secondaryLinks.map((l) => `${l.label}: ${l.url}`), "");
  }
  if (content.footer) {
    lines.push(content.footer);
  }
  return lines.join("\n").trim();
}

/**
 * Enqueues the email as a Message row (lib/messaging/outbox.ts) and sends
 * it immediately (lib/messaging/dispatcher.ts's sendOne) — logged either
 * way, but the caller still gets the same synchronous throw-on-failure
 * behavior this function always had, since every existing call site (e.g.
 * lib/invite.ts's createInvite/resendInvite) awaits it inside a try/catch
 * to surface a failure to the user right away. sendOne itself decides
 * whether a given failure is worth an automatic background retry — see its
 * doc comment — that part is new, but transparent to callers here.
 */
async function sendEmail(content: EmailContent) {
  const id = await enqueueEmail({
    templateKey: content.templateKey,
    category: content.category,
    to: content.to,
    subject: content.subject,
    html: renderEmailHtml(content),
    text: renderEmailText(content),
    dedupeKey: content.dedupeKey,
  });
  if (id) await sendOne(id);
}

interface WhatsappContent {
  templateKey: string;
  category?: MessageCategory;
  to: string;
  // Free-text fallback, used only on the rare chance the recipient's 24h
  // session window happens to already be open. Most calls here are a first
  // contact, so templateParams (below) is what actually reaches them.
  text: string;
  templateParams?: string[];
  // The dynamic URL button's single parameter (e.g. an invite token), for
  // a template that has one — see sendWhatsappTemplate in lib/whatsapp.ts.
  buttonParam?: string;
}

/**
 * WhatsApp counterpart to sendEmail — same enqueue-then-send-immediately
 * shape, but errors are swallowed (logged, not thrown): every call site
 * below fires this *alongside* an email that's expected to succeed on its
 * own, so a WhatsApp hiccup (template still pending approval, kill switch
 * off, recipient opted out) shouldn't make the whole notification look
 * like it failed when the email side is fine.
 */
async function sendWhatsapp(content: WhatsappContent) {
  try {
    const id = await enqueueWhatsapp({
      templateKey: content.templateKey,
      category: content.category,
      to: toE164India(content.to),
      text: content.text,
      templateParams: content.templateParams,
      buttonParam: content.buttonParam,
    });
    if (id) await sendOne(id);
  } catch (err) {
    console.error(`sendWhatsapp: failed for templateKey "${content.templateKey}"`, err);
  }
}

// Shared notification service (unified-platform-architecture.md Section 6,
// M7) — one function per trigger event, each firing email + (where a phone
// number is on record) SMS. Individual users (Managers/Office
// Bearers/staff) don't have a stored phone number in v1's schema — only
// VendorCompany.ownerPhone and Society registrant/secretary phone do — so
// SMS is only wired on functions where a real number is available.

export async function notifyNewRegistration(params: {
  type: "Society" | "Vendor";
  name: string;
  contactName: string;
  contactEmail: string;
  // Society only — Vendor registrations have no separate secretary contact.
  secretaryName?: string;
  secretaryEmail?: string;
  secretaryPhone?: string;
  approveUrl: string;
}) {
  const supportEmail = process.env.SUPPORT_EMAIL;
  if (!supportEmail) return;

  await sendEmail({
    templateKey: "internal.new_registration",
    to: supportEmail,
    subject: `New ${params.type} registration: ${params.name}`,
    heading: `New ${params.type} registration`,
    paragraphs: [
      `A new ${params.type} has registered on Wisesoc and is pending verification.`,
      `Name: ${params.name}`,
      `Contact: ${params.contactName} <${params.contactEmail}>`,
      ...(params.secretaryName
        ? [`Secretary: ${params.secretaryName} <${params.secretaryEmail}> — ${params.secretaryPhone}`]
        : []),
    ],
    cta: { label: "Review & Approve", url: params.approveUrl },
  });
}

// Society "Suggest a Vendor" (society-portal-spec.md) — tells the suggested
// vendor who pointed Wisesoc at them and from which society, with a link
// straight into the normal vendor registration flow (no special/prefilled
// suggestion-only path — they register the same way as anyone else).
export async function notifyVendorSuggested(params: {
  vendorName: string;
  vendorEmail: string;
  vendorPhone?: string | null;
  suggestedByName: string;
  societyName: string;
  registerUrl: string;
}) {
  // Decoupled (product decision, 2026-09-05): email and WhatsApp are two
  // independent channels for the same event, so one failing (e.g. Resend's
  // sandbox rejecting an unverified recipient) shouldn't stop the other
  // from being attempted. The email error, if any, is still re-thrown
  // afterward so callers keep surfacing "failed to send" the same way they
  // always have — it just no longer blocks WhatsApp from getting its turn.
  let emailError: unknown;
  try {
    await sendEmail({
      templateKey: "vendor.suggested",
      to: params.vendorEmail,
      subject: `${params.suggestedByName} suggested you register on Wisesoc`,
      heading: `You've been suggested as a vendor`,
      paragraphs: [
        `Hi ${params.vendorName},`,
        `${params.suggestedByName} from ${params.societyName} suggested you register as a vendor on Wisesoc — the platform housing societies use to find and hire vendors like you.`,
      ],
      cta: { label: "Register on Wisesoc", url: params.registerUrl },
    });
  } catch (err) {
    emailError = err;
  }

  if (params.vendorPhone) {
    // First contact — this always goes out via the approved
    // wisesoc_vendor_suggested_v2 template (whatsapp-templates.ts), not
    // free text, since there's no open session window with someone who's
    // never messaged us. Param order must match the template body's
    // {{1}}..{{3}} — the registration link in that template is the plain,
    // non-personalized page (product decision, 2026-09-05), so it isn't a
    // param here at all. The free-text fallback below (used only on the
    // rare chance their window happens to already be open) still gets the
    // personalized, prefilled link since that's not template-constrained.
    await sendWhatsapp({
      templateKey: "vendor.suggested",
      // Meta classified wisesoc_vendor_suggested_v2 as MARKETING on review
      // (2026-09-05) despite it being UTILITY at submission and having no
      // CTA button — inviting someone to register reads as promotional to
      // their policy regardless of wording. Tagged accordingly here so
      // Phase 2's marketing opt-out/frequency-cap gating (dispatcher.ts)
      // applies to this correctly instead of treating it as unlimited
      // TRANSACTIONAL send volume.
      category: "MARKETING",
      to: params.vendorPhone,
      text: `Wisesoc: ${params.suggestedByName} from ${params.societyName} suggested you register as a vendor on Wisesoc. Register: ${params.registerUrl}`,
      templateParams: [params.vendorName, params.suggestedByName, params.societyName],
    });
  }

  if (emailError) throw emailError;
}

// Note: while RESEND_API_KEY is sandboxed, this — like notifyRejection —
// won't actually reach a real invitee's inbox until a sending domain is
// verified (Resend only delivers to the account owner's own address).
// Human-readable phrasing for the raw RoleName sendInvite's callers pass in
// (e.g. "VENDOR_STAFF") — used only in the email subject/body below, not the
// WhatsApp send (that stays on the raw role value, which is what the
// already-approved Meta template's {{1}} placeholder was reviewed against —
// changing it risks a delivery failure for no email-side benefit). Falls
// back to the raw role for anything not in this map, though every
// createInvite call site today only ever passes one of these five.
const INVITE_ROLE_LABELS: Record<string, string> = {
  MANAGER: "Manager",
  CHAIRMAN: "Chairman",
  SECRETARY: "Secretary",
  TREASURER: "Treasurer",
  VENDOR_STAFF: "a staff member",
};

export async function sendInvite(params: {
  email: string;
  role: string;
  entityName: string | null;
  url: string;
  // The raw invite token (not the full url) — needed separately because
  // the WhatsApp template's button has the domain baked in permanently
  // (Meta template buttons can't vary by environment); only the token
  // suffix is a send-time parameter. See wisesoc_role_invite_v2 in
  // whatsapp-templates.ts.
  token: string;
  // Display name of whoever triggered this invite — threaded through from
  // createInvite/resendInvite (lib/invite.ts), which persists it on the
  // Invite row so a resend keeps showing the original inviter. Not used
  // (and not meaningful) on the registrationPitch path below, which already
  // names its own proposer.
  invitedByName?: string;
  // Given by the inviter, if known — the only way to reach this person
  // over WhatsApp before they've ever logged in. Undefined/omitted means
  // email-only, same as vendor.suggested's vendorPhone.
  phone?: string;
  // Custom framing for the society self-registration flow, where the
  // invitee didn't necessarily submit the registration themselves — replaces
  // the generic "You've been invited as {role}" opener.
  registrationPitch?: { proposerName: string; proposerRoleLabel: string; societyName: string };
}) {
  const forWhat = params.entityName ? ` for ${params.entityName}` : "";
  const roleLabel = INVITE_ROLE_LABELS[params.role] ?? params.role;
  const base = getBaseUrl();

  const paragraphs = params.registrationPitch
    ? [
        `${params.registrationPitch.proposerName} (${params.registrationPitch.proposerRoleLabel}) has proposed registration of ${params.registrationPitch.societyName} onto the free Wisesoc platform for managing vendor quotes transparently and fairly.`,
        `Create a password and set up your Office Bearer team and Manager to explore the portal.`,
      ]
    : [
        `Hi,`,
        params.invitedByName
          ? `${params.invitedByName} has invited you to join Wisesoc as ${roleLabel}${forWhat}.`
          : `You've been invited to join Wisesoc as ${roleLabel}${forWhat}.`,
      ];

  // Decoupled from the WhatsApp send below, same reasoning as
  // notifyVendorSuggested: independent channels for the same event, so one
  // failing shouldn't block the other. The email error, if any, is
  // re-thrown afterward so callers keep surfacing "failed to send" as
  // before.
  let emailError: unknown;
  try {
    await sendEmail({
      templateKey: "invite.role_activation",
      to: params.email,
      subject: params.registrationPitch
        ? `You're invited to set up ${params.registrationPitch.societyName} on Wisesoc`
        : `You've been invited to Wisesoc as ${roleLabel}${params.entityName ? ` of ${params.entityName}` : ""}`,
      heading: params.registrationPitch ? "Set up your society on Wisesoc" : "You've been invited to Wisesoc",
      paragraphs,
      cta: { label: "Create your password", url: params.url },
      secondaryLinks: params.registrationPitch ? [{ label: "the Wisesoc FAQ", url: `${base}/faq` }] : undefined,
      footer: "This link expires in 24 hours.",
    });
  } catch (err) {
    emailError = err;
  }

  if (params.phone && !params.registrationPitch) {
    // First contact — always goes out via the approved
    // wisesoc_role_invite_v2 template (whatsapp-templates.ts), not free
    // text, since there's no open session window with someone who's never
    // messaged us. Falls back to generic phrasing for the two required
    // placeholders that can't ever be blank in a Meta template.
    await sendWhatsapp({
      templateKey: "invite.role_activation",
      category: "MARKETING", // Meta classified this MARKETING on review, same as vendor.suggested — see whatsapp-templates.ts.
      to: params.phone,
      text: `Wisesoc: You've been given ${params.role} access${forWhat} by ${params.invitedByName ?? "a Wisesoc admin"}. Create your password: ${params.url}`,
      templateParams: [params.role, params.entityName ?? "Wisesoc", params.invitedByName ?? "a Wisesoc admin"],
      buttonParam: params.token,
    });
  }

  if (emailError) throw emailError;
}

// Same Resend sandbox caveat as sendInvite/notifyRejection.
export async function sendPasswordReset(params: { email: string; url: string }) {
  await sendEmail({
    templateKey: "auth.password_reset",
    to: params.email,
    subject: "Reset your Wisesoc password",
    heading: "Reset your password",
    paragraphs: ["We received a request to reset your Wisesoc password."],
    cta: { label: "Reset your password", url: params.url },
    footer: "This link expires in 1 hour. If you didn't request this, you can ignore this email.",
  });
}

// M6 — society-portal-spec.md Section 9. Same Resend sandbox caveat as the
// functions above throughout this file.

export async function notifyApprovalRequested(params: {
  recipients: string[];
  societyName: string;
  requirementName: string;
  reviewUrl: string;
}) {
  await Promise.all(
    params.recipients.map((to) =>
      sendEmail({
        templateKey: "society.approval_requested",
        to,
        subject: `Approval needed: ${params.societyName}`,
        heading: "Approval needed",
        paragraphs: [
          `A quotation for "${params.requirementName}" needs your approval (2 of 3 Office Bearers required) — it's at or above ${params.societyName}'s approval threshold.`,
        ],
        cta: { label: "Review & Vote", url: params.reviewUrl },
      }),
    ),
  );
}

export async function notifyFinalized(params: {
  recipients: string[];
  societyName: string;
  requirementName: string;
  workOrderNumber: string;
  reviewUrl: string;
}) {
  await Promise.all(
    params.recipients.map((to) =>
      sendEmail({
        templateKey: "society.finalized",
        to,
        subject: `Quotation finalized: ${params.societyName}`,
        heading: "Quotation finalized",
        paragraphs: [
          `The quotation for "${params.requirementName}" has been finalized. Work Order ${params.workOrderNumber} has been generated.`,
        ],
        cta: { label: "View Work Order", url: params.reviewUrl },
      }),
    ),
  );
}

export async function notifyReturnedToManager(params: {
  managerEmail: string;
  societyName: string;
  requirementName: string;
  reviewUrl: string;
}) {
  await sendEmail({
    templateKey: "society.returned_to_manager",
    to: params.managerEmail,
    subject: `Requirement sent back to you: ${params.societyName}`,
    heading: "Requirement sent back to you",
    paragraphs: [
      `The recommendation for "${params.requirementName}" was rejected by 2 of the 3 Office Bearers. It's been sent back to you to re-recommend or re-open quoting.`,
    ],
    cta: { label: "Review Requirement", url: params.reviewUrl },
  });
}

export async function notifyBidOutcome(params: {
  vendorEmail: string;
  vendorPhone?: string | null;
  requirementName: string;
  won: boolean;
}) {
  const message = params.won
    ? `Congratulations — your quote for "${params.requirementName}" was selected. Check My Quotes / History on Wisesoc for the Work Order.`
    : `Your quote for "${params.requirementName}" was not selected this time. Check My Quotes / History on Wisesoc for details.`;

  await sendEmail({
    templateKey: "vendor.bid_outcome",
    to: params.vendorEmail,
    subject: params.won ? "You were selected on Wisesoc" : "Quote outcome on Wisesoc",
    heading: params.won ? "You were selected!" : "Quote outcome",
    paragraphs: [message],
  });
  // SMS intentionally not sent — see notifyVendorSuggested above.
  // await sendSms({ to: params.vendorPhone, body: `Wisesoc: ${message}` });
}

export async function notifyThresholdChangeProposed(params: {
  recipients: string[];
  societyName: string;
  oldValue: string;
  newValue: string;
  proposerName: string;
  reviewUrl: string;
}) {
  await Promise.all(
    params.recipients.map((to) =>
      sendEmail({
        templateKey: "society.threshold_change_proposed",
        to,
        subject: `Threshold change proposed: ${params.societyName}`,
        heading: "Threshold change proposed",
        paragraphs: [
          `${params.proposerName} proposed changing ${params.societyName}'s approval threshold from ₹${params.oldValue} to ₹${params.newValue}. One other Office Bearer's approval is needed.`,
        ],
        cta: { label: "Review & Decide", url: params.reviewUrl },
      }),
    ),
  );
}

export async function notifyThresholdChangeDecided(params: {
  proposerEmail: string;
  societyName: string;
  oldValue: string;
  newValue: string;
  approved: boolean;
  deciderName: string;
}) {
  await sendEmail({
    templateKey: "society.threshold_change_decided",
    to: params.proposerEmail,
    subject: `Threshold change ${params.approved ? "approved" : "rejected"}: ${params.societyName}`,
    heading: `Threshold change ${params.approved ? "approved" : "rejected"}`,
    paragraphs: [
      `Your proposed threshold change (₹${params.oldValue} → ₹${params.newValue}) for ${params.societyName} was ${
        params.approved ? "approved" : "rejected"
      } by ${params.deciderName}.`,
    ],
  });
}

// M8 — member removal (society-portal-spec.md Section 7.2), same
// propose/decide co-approval pattern as the threshold above.
export async function notifyMemberRemovalProposed(params: {
  recipients: string[];
  societyName: string;
  targetName: string;
  proposerName: string;
  reviewUrl: string;
}) {
  await Promise.all(
    params.recipients.map((to) =>
      sendEmail({
        templateKey: "society.member_removal_proposed",
        to,
        subject: `Member removal proposed: ${params.societyName}`,
        heading: "Member removal proposed",
        paragraphs: [
          `${params.proposerName} proposed removing ${params.targetName} from ${params.societyName}. One other Office Bearer's approval is needed.`,
        ],
        cta: { label: "Review & Decide", url: params.reviewUrl },
      }),
    ),
  );
}

export async function notifyMemberRemovalDecided(params: {
  proposerEmail: string;
  societyName: string;
  targetName: string;
  approved: boolean;
  deciderName: string;
}) {
  await sendEmail({
    templateKey: "society.member_removal_decided",
    to: params.proposerEmail,
    subject: `Member removal ${params.approved ? "approved" : "rejected"}: ${params.societyName}`,
    heading: `Member removal ${params.approved ? "approved" : "rejected"}`,
    paragraphs: [
      `Your proposal to remove ${params.targetName} from ${params.societyName} was ${
        params.approved ? "approved" : "rejected"
      } by ${params.deciderName}.`,
    ],
  });
}

// Sent to the removed person themselves once the removal is approved — their
// Wisesoc login still exists (other role assignments, if any, are untouched),
// they just lose access to this specific society.
export async function notifyMemberRemoved(params: { email: string; societyName: string }) {
  await sendEmail({
    templateKey: "society.member_removed",
    to: params.email,
    subject: `Removed from ${params.societyName} on Wisesoc`,
    heading: "You've been removed",
    paragraphs: [
      `You've been removed from ${params.societyName} on Wisesoc and no longer have access to that workspace. If you believe this was a mistake, please get in touch with the society directly.`,
    ],
  });
}

// Fast-path invite: the invitee already has a real Wisesoc account (a
// passwordHash is set), so there's no password-setup step — just tell them
// they've been added and point them at /login instead of an invite token.
export async function notifyAddedToExistingAccount(params: {
  email: string;
  role: string;
  entityName: string | null;
  loginUrl: string;
}) {
  const forWhat = params.entityName ? ` for ${params.entityName}` : "";
  const roleLabel = INVITE_ROLE_LABELS[params.role] ?? params.role;
  await sendEmail({
    templateKey: "invite.added_to_existing_account",
    to: params.email,
    subject: `You've been added to Wisesoc as ${roleLabel}${params.entityName ? ` of ${params.entityName}` : ""}`,
    heading: "You've been added to Wisesoc",
    paragraphs: [`You've been added as ${roleLabel}${forWhat} on Wisesoc, using your existing account (${params.email}).`],
    cta: { label: "Log in", url: params.loginUrl },
  });
}

// Note: while RESEND_API_KEY is sandboxed (no verified sending domain),
// Resend only delivers to the account owner's own verified address — this
// won't actually reach the applicant's inbox until a domain is verified.
export async function notifyRejection(params: {
  type: "Society" | "Vendor";
  name: string;
  contactEmail: string;
  contactPhone?: string | null;
  reason: string;
}) {
  const reason = params.reason || "No reason provided.";

  await sendEmail({
    templateKey: "registration.rejected",
    to: params.contactEmail,
    subject: `Your ${params.type} registration on Wisesoc`,
    heading: "Registration not approved",
    paragraphs: [
      `Your ${params.type} registration for "${params.name}" was not approved.`,
      `Reason: ${reason}`,
      `If you believe this was a mistake or would like to re-apply with corrected details, please get in touch with Wisesoc support.`,
    ],
  });
  // SMS intentionally not sent — see notifyVendorSuggested above.
  // await sendSms({ to: params.contactPhone, body: `Wisesoc: Your ${params.type} registration for "${params.name}" was not approved. Reason: ${reason}` });
}

// M7 — registration confirmation (society-portal-spec.md /
// vendor-registration-portal-spec.md Section 9, "Registration submitted").
export async function notifyRegistrationSubmitted(params: {
  type: "Society" | "Vendor";
  name: string;
  contactEmail: string;
  contactPhone?: string | null;
}) {
  const body = `Your ${params.type} registration for "${params.name}" on Wisesoc has been submitted and is pending verification. We'll notify you once it's reviewed.`;

  await sendEmail({
    templateKey: "registration.submitted",
    to: params.contactEmail,
    subject: `Your ${params.type} registration was submitted`,
    heading: "Registration submitted",
    paragraphs: [body],
  });
  // SMS intentionally not sent — see notifyVendorSuggested above.
  // await sendSms({ to: params.contactPhone, body: `Wisesoc: ${body}` });
}

// M7 — registration approval (currently only wired for Vendors: Society
// approval already implicitly notifies the invitee via the activation
// invite email in admin/societies/[id]/actions.ts).
export async function notifyApproval(params: {
  type: "Society" | "Vendor";
  name: string;
  contactEmail: string;
  contactPhone?: string | null;
  // Vendor-only — Society approval already points the invitee at the
  // platform via the separate activation invite email (createInvite), so
  // this is just for the Vendor Owner's "what do I do now" next steps
  // (below) and the WhatsApp button, which links through
  // /vendor-profile/{id} (see that route's own comment).
  vendorCompanyId?: string;
}) {
  const base = getBaseUrl();

  await sendEmail({
    templateKey: "registration.approved",
    to: params.contactEmail,
    subject: `Your ${params.type} registration was approved`,
    heading: "Registration approved",
    paragraphs: [`Good news — your ${params.type} registration for "${params.name}" on Wisesoc has been approved and is now active.`],
    steps:
      params.type === "Vendor" && params.vendorCompanyId
        ? [
            {
              label: "Complete your profile",
              description: "Add your GST/PAN, years in business, and a short description so societies can find and trust you faster.",
              url: `${base}/vendor/${params.vendorCompanyId}/profile`,
              linkLabel: "Complete your profile",
            },
            {
              label: "Invite your team",
              description: "Add staff members who can also submit quotes on requirements on your behalf.",
              url: `${base}/vendor/${params.vendorCompanyId}/staff`,
              linkLabel: "Invite your team",
            },
          ]
        : undefined,
  });
  // SMS intentionally not sent — see notifyVendorSuggested above.
  // await sendSms({ to: params.contactPhone, body: `Wisesoc: Good news — your ${params.type} registration for "${params.name}" on Wisesoc has been approved and is now active.` });

  if (params.type === "Vendor" && params.contactPhone && params.vendorCompanyId) {
    await sendWhatsapp({
      templateKey: "vendor.approved",
      category: "TRANSACTIONAL",
      to: params.contactPhone,
      text: `Great news — your Wisesoc registration for ${params.name} has been approved. Next step: complete your profile with more details so we can match you accurately with requirements on the portal from societies.`,
      templateParams: [params.name],
      buttonParam: params.vendorCompanyId,
    });
  }
}

// Society registration confirmation to the registrant, sent only when the
// activation invite went to someone other than them (register/society +
// admin/societies/[id]/actions.ts approveSociety).
export async function notifySocietyRegistrationApprovedToRegistrant(params: {
  registrantEmail: string;
  registrantName: string;
  societyName: string;
  inviteeName: string;
  inviteeRoleLabel: string;
  inviteeEmail: string;
}) {
  await sendEmail({
    templateKey: "registration.society_approved_to_registrant",
    to: params.registrantEmail,
    subject: `${params.societyName} was approved on Wisesoc`,
    heading: "Your registration was approved",
    paragraphs: [
      `Hi ${params.registrantName},`,
      `${params.societyName}'s registration on Wisesoc has been approved. We've sent an activation invite to ${params.inviteeName} (${params.inviteeRoleLabel}) at ${params.inviteeEmail} to set up the account and password.`,
      `Once they've set things up, they can invite you and the rest of the committee from the Members page.`,
    ],
  });
}

// M7 — vendor-registration-portal-spec.md Section 9, "New requirement
// matched (invite to bid)". Fires once per matched vendor when the
// matching engine's invite pool is created (society/[id]/requirements/actions.ts).
export async function notifyRequirementMatched(params: {
  vendorEmail: string;
  vendorPhone?: string | null;
  vendorName: string;
  categoryName: string;
  societyName: string;
  requirementTitle: string;
  deadline: Date;
  reviewUrl: string;
}) {
  await sendEmail({
    templateKey: "vendor.requirement_matched",
    to: params.vendorEmail,
    subject: `New requirement matched: ${params.categoryName}`,
    heading: "New requirement matched",
    paragraphs: [`A new ${params.categoryName} requirement from ${params.societyName} matches your profile.`],
    cta: { label: "Submit your quote", url: params.reviewUrl },
  });
  // SMS intentionally not sent — see notifyVendorSuggested above.
  // await sendSms({ to: params.vendorPhone, body: `Wisesoc: A new ${params.categoryName} requirement from ${params.societyName} matches your profile. Submit your quote: ${params.reviewUrl}` });

  if (params.vendorPhone) {
    await sendWhatsapp({
      templateKey: "requirement.matched",
      // Meta reclassified this MARKETING on both WABAs despite two UTILITY
      // submission attempts (v1 and a reworded v2) — see the extensive
      // history comment in whatsapp-templates.ts. Tagged to match reality.
      category: "MARKETING",
      to: params.vendorPhone,
      text: `Update on your Wisesoc profile: requirement "${params.requirementTitle}" in ${params.categoryName} category matched for ${params.vendorName}. Quote submission deadline: ${formatWhatsappDeadline(params.deadline)} (IST).`,
      templateParams: [params.requirementTitle, params.categoryName, params.vendorName, formatWhatsappDeadline(params.deadline)],
      // Login button is a static URL (no per-recipient suffix) — no buttonParam needed.
    });
  }
}

// Used when a vendor becomes newly eligible for several open requirements at
// once (approval, or a profile edit widening their categories/cities) — one
// summary email instead of one per requirement (lib/matching.ts,
// syncVendorRequirementMatches).
export async function notifyVendorMatchedRequirements(params: {
  vendorEmail: string;
  vendorPhone?: string | null;
  vendorName: string;
  requirements: { title: string; categoryName: string; societyName: string; deadline: Date }[];
  dashboardUrl: string;
}) {
  const count = params.requirements.length;

  await sendEmail({
    templateKey: "vendor.requirements_matched_batch",
    to: params.vendorEmail,
    subject: `You've been matched with ${count} new requirement${count === 1 ? "" : "s"}`,
    heading: "New requirements matched",
    paragraphs: [`You've been matched with ${count} new requirement${count === 1 ? "" : "s"} that fit your profile:`],
    list: params.requirements.map((r) => `${r.categoryName} for ${r.societyName}`),
    cta: { label: "View your dashboard", url: params.dashboardUrl },
  });
  // SMS intentionally not sent — see notifyVendorSuggested above.
  // await sendSms({ to: params.vendorPhone, body: `Wisesoc: You've been matched with ${count} new requirement${count === 1 ? "" : "s"}. Check your dashboard: ${params.dashboardUrl}` });

  // One WhatsApp per matched requirement, even though the email above is a
  // single batch summary (2026-09-07 product decision) — each message uses
  // the same wisesoc_requirement_matched_v2 template as the single-match
  // path (notifyRequirementMatched), so a vendor can't tell from the
  // message itself whether it came from a batch trigger or a fresh
  // requirement.
  if (params.vendorPhone) {
    for (const r of params.requirements) {
      await sendWhatsapp({
        templateKey: "requirement.matched",
        // See the category comment in notifyRequirementMatched above —
        // Meta reclassified this MARKETING regardless of two UTILITY
        // submission attempts.
        category: "MARKETING",
        to: params.vendorPhone,
        text: `Update on your Wisesoc profile: requirement "${r.title}" in ${r.categoryName} category matched for ${params.vendorName}. Quote submission deadline: ${formatWhatsappDeadline(r.deadline)} (IST).`,
        templateParams: [r.title, r.categoryName, params.vendorName, formatWhatsappDeadline(r.deadline)],
      });
    }
  }
}

// M7 — vendor-registration-portal-spec.md Section 9, "New category request
// approved/rejected".
export async function notifyCategoryRequestDecided(params: {
  vendorEmail: string;
  vendorPhone?: string | null;
  categoryName: string;
  approved: boolean;
}) {
  const body = params.approved
    ? `Your requested category "${params.categoryName}" has been approved and added to your profile.`
    : `Your requested category "${params.categoryName}" was not approved.`;

  await sendEmail({
    templateKey: "vendor.category_request_decided",
    to: params.vendorEmail,
    subject: `Category request ${params.approved ? "approved" : "rejected"}: ${params.categoryName}`,
    heading: `Category request ${params.approved ? "approved" : "rejected"}`,
    paragraphs: [body],
  });
  // SMS intentionally not sent — see notifyVendorSuggested above.
  // await sendSms({ to: params.vendorPhone, body: `Wisesoc: ${body}` });
}

// M7 — society-portal-spec.md Section 9, "Requirement's bid deadline
// approaching (to Manager)". No phone on record for individual Managers,
// email-only. Sent by the deadline-reminders cron route.
export async function notifyDeadlineApproaching(params: {
  managerEmails: string[];
  societyName: string;
  requirementName: string;
  reviewUrl: string;
  // Cron-route callers pass a per-requirement base (e.g. the requirement
  // id) so a retry of the same event — even one triggered by a bug, not
  // just a legitimate re-run — can't send the same manager the same
  // reminder twice. See EmailContent.dedupeKey.
  dedupeKeyBase?: string;
}) {
  await Promise.all(
    params.managerEmails.map((to) =>
      sendEmail({
        templateKey: "society.deadline_approaching",
        category: "REMINDER",
        to,
        subject: `Quote deadline approaching: ${params.societyName}`,
        heading: "Quote deadline approaching",
        paragraphs: [`The quote deadline for "${params.requirementName}" closes within 24 hours.`],
        cta: { label: "Review Requirement", url: params.reviewUrl },
        dedupeKey: params.dedupeKeyBase ? `deadline-approaching:${params.dedupeKeyBase}:${to}` : undefined,
      }),
    ),
  );
}

// M7 — society-portal-spec.md Section 9, "Bids ready for review (deadline
// closed)". Sent by the deadline-reminders cron route.
export async function notifyBidsReadyForReview(params: {
  managerEmails: string[];
  societyName: string;
  requirementName: string;
  reviewUrl: string;
  dedupeKeyBase?: string;
}) {
  await Promise.all(
    params.managerEmails.map((to) =>
      sendEmail({
        templateKey: "society.quotes_ready",
        category: "REMINDER",
        to,
        subject: `Quotes ready for review: ${params.societyName}`,
        heading: "Quotes ready for review",
        paragraphs: [
          `Quote submission has closed for "${params.requirementName}" — the submitted quotes are ready for your review and recommendation.`,
        ],
        cta: { label: "Review Quotes", url: params.reviewUrl },
        dedupeKey: params.dedupeKeyBase ? `bids-ready:${params.dedupeKeyBase}:${to}` : undefined,
      }),
    ),
  );
}

// Admin-initiated suspend/reactivate toggle (admin/vendors/[id]/actions.ts).
export async function notifyVendorStatusChanged(params: {
  vendorName: string;
  contactEmail: string;
  contactPhone?: string | null;
  suspended: boolean;
}) {
  await sendEmail({
    templateKey: "vendor.status_changed",
    to: params.contactEmail,
    subject: params.suspended ? "Your Wisesoc vendor account has been suspended" : "Your Wisesoc vendor account has been reactivated",
    heading: params.suspended ? "Account suspended" : "Account reactivated",
    paragraphs: params.suspended
      ? [
          `Your vendor account "${params.vendorName}" on Wisesoc has been suspended by an administrator. You won't be matched to new requirements while suspended.`,
          `If you believe this is a mistake, please get in touch with Wisesoc support.`,
        ]
      : [`Good news — your vendor account "${params.vendorName}" on Wisesoc has been reactivated and is active again.`],
  });
  // SMS intentionally not sent — see notifyVendorSuggested above.
  // await sendSms({ to: params.contactPhone, body: `Wisesoc: ...` });
}

// Contact Us form (public, unauthenticated) — forwards the message straight
// to SUPPORT_EMAIL. No-op if SUPPORT_EMAIL isn't configured, same as
// notifyNewRegistration above.
export async function notifyContactMessage(params: {
  name: string;
  email: string;
  message: string;
}) {
  const supportEmail = process.env.SUPPORT_EMAIL;
  if (!supportEmail) return;

  await sendEmail({
    templateKey: "internal.contact_message",
    to: supportEmail,
    subject: `New Contact Us message from ${params.name}`,
    heading: "New Contact Us message",
    paragraphs: [`Name: ${params.name}`, `Email: ${params.email}`, params.message],
  });
}

// M7 — vendor-registration-portal-spec.md Section 9, "Bid deadline reminder
// (e.g., 24 hrs before close)". Sent by the deadline-reminders cron route,
// only to vendors invited to this requirement who haven't submitted a bid yet.
export async function notifyBidDeadlineReminder(params: {
  vendorEmail: string;
  vendorPhone?: string | null;
  requirementName: string;
  reviewUrl: string;
  dedupeKeyBase?: string;
}) {
  await sendEmail({
    templateKey: "vendor.bid_deadline_reminder",
    category: "REMINDER",
    to: params.vendorEmail,
    subject: "Quote deadline closing soon",
    heading: "Quote deadline closing soon",
    paragraphs: [`The quote deadline for "${params.requirementName}" closes within 24 hours.`],
    cta: { label: "Submit your quote", url: params.reviewUrl },
    dedupeKey: params.dedupeKeyBase ? `bid-deadline-reminder:${params.dedupeKeyBase}:${params.vendorEmail}` : undefined,
  });
  // SMS intentionally not sent — see notifyVendorSuggested above.
  // await sendSms({ to: params.vendorPhone, body: `Wisesoc: The quote deadline for "${params.requirementName}" closes within 24 hours. Submit your quote: ${params.reviewUrl}` });
}

// Manager-upload-a-vendor-quote feature (society-portal-spec.md — drag a
// vendor's own PDF/image/Excel quote onto an invited-vendor row, parsed and
// entered on their behalf). Sent every time, so the vendor always has a
// record even though there's no sign-off step before the Bid is created —
// a vendor who disagrees with the eventual Work Order can dispute it then,
// same as any other quote (product decision, 2026-09-10).
export async function notifyBidUploadedOnBehalf(params: {
  vendorEmail: string;
  vendorPhone?: string | null;
  vendorName: string;
  bidId: string;
  requirementName: string;
  societyName: string;
  totalAmount: string;
  // Present only for a GST-compliant quote — shown as a Subtotal/GST/Grand
  // Total breakdown instead of the flat totalAmount line.
  gst?: { subtotal: string; totalGst: string; grandTotal: string };
  managerName: string;
  bidDeadline: Date;
  reviewUrl: string;
}) {
  const grandTotal = params.gst?.grandTotal ?? params.totalAmount;
  const totalLine = params.gst
    ? `${params.managerName} at ${params.societyName} uploaded your quotation document for "${params.requirementName}" and it's now on file as your submitted quote — subtotal ₹${params.gst.subtotal}, GST ₹${params.gst.totalGst}, grand total ₹${params.gst.grandTotal}.`
    : `${params.managerName} at ${params.societyName} uploaded your quotation document for "${params.requirementName}" and it's now on file as your submitted quote — total ₹${params.totalAmount}.`;

  await sendEmail({
    templateKey: "vendor.bid_uploaded_on_behalf",
    to: params.vendorEmail,
    subject: `Your quote for "${params.requirementName}" was logged on your behalf`,
    heading: "Quote logged on your behalf",
    paragraphs: [
      totalLine,
      `Please check that this matches what you sent. You can view or edit it from your dashboard any time before the quote deadline closes on ${formatDateTime(params.bidDeadline)}.`,
    ],
    cta: { label: "View your quote", url: params.reviewUrl },
  });

  if (params.vendorPhone) {
    await sendWhatsapp({
      templateKey: "bid.uploaded_on_behalf",
      // Submitted as UTILITY (2026-09-11, pending Test WABA approval) — same
      // plain account/quote-status framing as vendor.approved, the only
      // template so far to hold UTILITY rather than get reclassified
      // MARKETING. Update this once the actual Meta decision is known if it
      // ever gets reclassified (see whatsapp-templates.ts's history comments
      // for the pattern of tagging categories to match reality, not intent).
      category: "TRANSACTIONAL",
      to: params.vendorPhone,
      text: `Your quote for "${params.requirementName}" was logged on Wisesoc by ${params.societyName} — total ₹${grandTotal}. Please check it matches what you sent before the deadline on ${formatWhatsappDeadline(params.bidDeadline)} (IST).`,
      templateParams: [params.requirementName, params.societyName, grandTotal, formatWhatsappDeadline(params.bidDeadline)],
      buttonParam: params.bidId,
    });
  }
}
