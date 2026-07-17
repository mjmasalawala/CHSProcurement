import { Resend } from "resend";
import { sendSms } from "@/lib/sms";

const resend = new Resend(process.env.RESEND_API_KEY);

// Falls back to Resend's shared sandbox sender, which only delivers to the
// account owner's own verified address (SUPPORT_EMAIL) — set RESEND_FROM_EMAIL
// to a verified-domain address once a sending domain is verified in Resend,
// to unlock real delivery. RESEND_FROM_EMAIL is just a bare address (no
// display name), so always wrap it with the ProSoc name here.
const FROM = `ProSoc <${process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"}>`;

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
  // Smaller "Click here for…" links below the CTA — e.g. an FAQ page.
  secondaryLinks?: EmailLink[];
  // Small print at the very bottom (expiry notes, etc).
  footer?: string;
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
        <tr><td style="border-radius:8px;background-color:#2f6f4f;">
          <a href="${content.cta.url}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(
            content.cta.label,
          )}</a>
        </td></tr>
      </table>`
    : "";

  const secondaryLinksHtml = content.secondaryLinks?.length
    ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;">${content.secondaryLinks
        .map((l) => `<a href="${l.url}" style="color:#2f6f4f;text-decoration:underline;">Click here for ${escapeHtml(l.label)}</a>`)
        .join(" &nbsp;·&nbsp; ")}</p>`
    : "";

  const footerHtml = content.footer
    ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#8a8a8a;">${escapeHtml(content.footer)}</p>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background-color:#f4f4f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8e6e1;">
      <tr><td style="padding:20px 32px;background-color:#1f3d2c;">
        <span style="font-size:16px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">ProSoc</span>
      </td></tr>
      <tr><td style="padding:28px 32px 32px;">
        <h1 style="margin:0 0 16px;font-size:19px;font-weight:700;color:#1f1f1f;">${escapeHtml(content.heading)}</h1>
        ${paragraphsHtml}
        ${listHtml}
        ${ctaHtml}
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
  if (content.secondaryLinks?.length) {
    lines.push(...content.secondaryLinks.map((l) => `${l.label}: ${l.url}`), "");
  }
  if (content.footer) {
    lines.push(content.footer);
  }
  return lines.join("\n").trim();
}

/**
 * The Resend SDK does NOT throw on API-level failures (invalid/unverified
 * sending domain, bad recipient, etc.) — it resolves with { data, error }.
 * Routing every send through here makes that failure loud instead of silent,
 * and centralizes the html+text templating so every notify* function below
 * just supplies content, not markup.
 */
async function sendEmail(content: EmailContent) {
  const { error } = await resend.emails.send({
    from: FROM,
    to: content.to,
    subject: content.subject,
    text: renderEmailText(content),
    html: renderEmailHtml(content),
  });
  if (error) {
    throw new Error(`Resend send failed (to: ${content.to}, subject: "${content.subject}"): ${error.message}`);
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
  approveUrl: string;
}) {
  const supportEmail = process.env.SUPPORT_EMAIL;
  if (!supportEmail) return;

  await sendEmail({
    to: supportEmail,
    subject: `New ${params.type} registration: ${params.name}`,
    heading: `New ${params.type} registration`,
    paragraphs: [
      `A new ${params.type} has registered on ProSoc and is pending verification.`,
      `Name: ${params.name}`,
      `Contact: ${params.contactName} <${params.contactEmail}>`,
    ],
    cta: { label: "Review & Approve", url: params.approveUrl },
  });
}

// Society "Suggest a Vendor" (society-portal-spec.md) — tells the suggested
// vendor who pointed ProSoc at them and from which society, with a link
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
  const smsBody = `${params.suggestedByName} from ${params.societyName} suggested you register as a vendor on ProSoc. Register: ${params.registerUrl}`;

  await Promise.all([
    sendEmail({
      to: params.vendorEmail,
      subject: `${params.suggestedByName} suggested you register on ProSoc`,
      heading: `You've been suggested as a vendor`,
      paragraphs: [
        `Hi ${params.vendorName},`,
        `${params.suggestedByName} from ${params.societyName} suggested you register as a vendor on ProSoc — the platform housing societies use to find and hire vendors like you.`,
      ],
      cta: { label: "Register on ProSoc", url: params.registerUrl },
    }),
    sendSms({ to: params.vendorPhone, body: `ProSoc: ${smsBody}` }),
  ]);
}

// Note: while RESEND_API_KEY is sandboxed, this — like notifyRejection —
// won't actually reach a real invitee's inbox until a sending domain is
// verified (Resend only delivers to the account owner's own address).
export async function sendInvite(params: {
  email: string;
  role: string;
  entityName: string | null;
  url: string;
  // Custom framing for the society self-registration flow, where the
  // invitee didn't necessarily submit the registration themselves — replaces
  // the generic "You've been invited as {role}" opener.
  registrationPitch?: { proposerName: string; proposerRoleLabel: string; societyName: string };
}) {
  const forWhat = params.entityName ? ` for ${params.entityName}` : "";
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const paragraphs = params.registrationPitch
    ? [
        `${params.registrationPitch.proposerName} (${params.registrationPitch.proposerRoleLabel}) has proposed registration of ${params.registrationPitch.societyName} onto the free ProSoc platform for managing vendor quotes transparently and fairly.`,
        `Create a password and set up your Office Bearer team and Manager to explore the portal.`,
      ]
    : [`Hi,`, `You've been invited to join ProSoc as ${params.role}${forWhat}.`];

  await sendEmail({
    to: params.email,
    subject: params.registrationPitch
      ? `You're invited to set up ${params.registrationPitch.societyName} on ProSoc`
      : `You've been invited to ProSoc as ${params.role}`,
    heading: params.registrationPitch ? "Set up your society on ProSoc" : "You've been invited to ProSoc",
    paragraphs,
    cta: { label: "Create your password", url: params.url },
    secondaryLinks: params.registrationPitch ? [{ label: "the ProSoc FAQ", url: `${base}/faq` }] : undefined,
    footer: "This link expires in 7 days.",
  });
}

// Same Resend sandbox caveat as sendInvite/notifyRejection.
export async function sendPasswordReset(params: { email: string; url: string }) {
  await sendEmail({
    to: params.email,
    subject: "Reset your ProSoc password",
    heading: "Reset your password",
    paragraphs: ["We received a request to reset your ProSoc password."],
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
    ? `Congratulations — your quote for "${params.requirementName}" was selected. Check My Quotes / History on ProSoc for the Work Order.`
    : `Your quote for "${params.requirementName}" was not selected this time. Check My Quotes / History on ProSoc for details.`;

  await Promise.all([
    sendEmail({
      to: params.vendorEmail,
      subject: params.won ? "You were selected on ProSoc" : "Quote outcome on ProSoc",
      heading: params.won ? "You were selected!" : "Quote outcome",
      paragraphs: [message],
    }),
    sendSms({ to: params.vendorPhone, body: `ProSoc: ${message}` }),
  ]);
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
// ProSoc login still exists (other role assignments, if any, are untouched),
// they just lose access to this specific society.
export async function notifyMemberRemoved(params: { email: string; societyName: string }) {
  await sendEmail({
    to: params.email,
    subject: `Removed from ${params.societyName} on ProSoc`,
    heading: "You've been removed",
    paragraphs: [
      `You've been removed from ${params.societyName} on ProSoc and no longer have access to that workspace. If you believe this was a mistake, please get in touch with the society directly.`,
    ],
  });
}

// Fast-path invite: the invitee already has a real ProSoc account (a
// passwordHash is set), so there's no password-setup step — just tell them
// they've been added and point them at /login instead of an invite token.
export async function notifyAddedToExistingAccount(params: {
  email: string;
  role: string;
  entityName: string | null;
  loginUrl: string;
}) {
  const forWhat = params.entityName ? ` for ${params.entityName}` : "";
  await sendEmail({
    to: params.email,
    subject: `You've been added to ProSoc as ${params.role}`,
    heading: "You've been added to ProSoc",
    paragraphs: [`You've been added as ${params.role}${forWhat} on ProSoc, using your existing account (${params.email}).`],
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
  const smsBody = `Your ${params.type} registration for "${params.name}" was not approved. Reason: ${reason}`;

  await Promise.all([
    sendEmail({
      to: params.contactEmail,
      subject: `Your ${params.type} registration on ProSoc`,
      heading: "Registration not approved",
      paragraphs: [
        `Your ${params.type} registration for "${params.name}" was not approved.`,
        `Reason: ${reason}`,
        `If you believe this was a mistake or would like to re-apply with corrected details, please get in touch with ProSoc support.`,
      ],
    }),
    sendSms({ to: params.contactPhone, body: `ProSoc: ${smsBody}` }),
  ]);
}

// M7 — registration confirmation (society-portal-spec.md /
// vendor-registration-portal-spec.md Section 9, "Registration submitted").
export async function notifyRegistrationSubmitted(params: {
  type: "Society" | "Vendor";
  name: string;
  contactEmail: string;
  contactPhone?: string | null;
}) {
  const body = `Your ${params.type} registration for "${params.name}" on ProSoc has been submitted and is pending verification. We'll notify you once it's reviewed.`;

  await Promise.all([
    sendEmail({
      to: params.contactEmail,
      subject: `Your ${params.type} registration was submitted`,
      heading: "Registration submitted",
      paragraphs: [body],
    }),
    sendSms({ to: params.contactPhone, body: `ProSoc: ${body}` }),
  ]);
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
  // this is just for the Vendor Owner's "check requirements" nudge.
  dashboardUrl?: string;
}) {
  const smsBody = `Good news — your ${params.type} registration for "${params.name}" on ProSoc has been approved and is now active.`;

  await Promise.all([
    sendEmail({
      to: params.contactEmail,
      subject: `Your ${params.type} registration was approved`,
      heading: "Registration approved",
      paragraphs: [`Good news — your ${params.type} registration for "${params.name}" on ProSoc has been approved and is now active.`],
      cta: params.dashboardUrl ? { label: "Go to your dashboard", url: params.dashboardUrl } : undefined,
    }),
    sendSms({ to: params.contactPhone, body: `ProSoc: ${smsBody}` }),
  ]);
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
    to: params.registrantEmail,
    subject: `${params.societyName} was approved on ProSoc`,
    heading: "Your registration was approved",
    paragraphs: [
      `Hi ${params.registrantName},`,
      `${params.societyName}'s registration on ProSoc has been approved. We've sent an activation invite to ${params.inviteeName} (${params.inviteeRoleLabel}) at ${params.inviteeEmail} to set up the account and password.`,
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
  categoryName: string;
  societyName: string;
  reviewUrl: string;
}) {
  const smsBody = `A new ${params.categoryName} requirement from ${params.societyName} matches your profile. Submit your quote: ${params.reviewUrl}`;

  await Promise.all([
    sendEmail({
      to: params.vendorEmail,
      subject: `New requirement matched: ${params.categoryName}`,
      heading: "New requirement matched",
      paragraphs: [`A new ${params.categoryName} requirement from ${params.societyName} matches your profile.`],
      cta: { label: "Submit your quote", url: params.reviewUrl },
    }),
    sendSms({ to: params.vendorPhone, body: `ProSoc: ${smsBody}` }),
  ]);
}

// Used when a vendor becomes newly eligible for several open requirements at
// once (approval, or a profile edit widening their categories/cities) — one
// summary email instead of one per requirement (lib/matching.ts,
// syncVendorRequirementMatches).
export async function notifyVendorMatchedRequirements(params: {
  vendorEmail: string;
  vendorPhone?: string | null;
  requirements: { categoryName: string; societyName: string }[];
  dashboardUrl: string;
}) {
  const count = params.requirements.length;

  await Promise.all([
    sendEmail({
      to: params.vendorEmail,
      subject: `You've been matched with ${count} new requirement${count === 1 ? "" : "s"}`,
      heading: "New requirements matched",
      paragraphs: [`You've been matched with ${count} new requirement${count === 1 ? "" : "s"} that fit your profile:`],
      list: params.requirements.map((r) => `${r.categoryName} for ${r.societyName}`),
      cta: { label: "View your dashboard", url: params.dashboardUrl },
    }),
    sendSms({
      to: params.vendorPhone,
      body: `ProSoc: You've been matched with ${count} new requirement${count === 1 ? "" : "s"}. Check your dashboard: ${params.dashboardUrl}`,
    }),
  ]);
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

  await Promise.all([
    sendEmail({
      to: params.vendorEmail,
      subject: `Category request ${params.approved ? "approved" : "rejected"}: ${params.categoryName}`,
      heading: `Category request ${params.approved ? "approved" : "rejected"}`,
      paragraphs: [body],
    }),
    sendSms({ to: params.vendorPhone, body: `ProSoc: ${body}` }),
  ]);
}

// M7 — society-portal-spec.md Section 9, "Requirement's bid deadline
// approaching (to Manager)". No phone on record for individual Managers,
// email-only. Sent by the deadline-reminders cron route.
export async function notifyDeadlineApproaching(params: {
  managerEmails: string[];
  societyName: string;
  requirementName: string;
  reviewUrl: string;
}) {
  await Promise.all(
    params.managerEmails.map((to) =>
      sendEmail({
        to,
        subject: `Quote deadline approaching: ${params.societyName}`,
        heading: "Quote deadline approaching",
        paragraphs: [`The quote deadline for "${params.requirementName}" closes within 24 hours.`],
        cta: { label: "Review Requirement", url: params.reviewUrl },
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
}) {
  await Promise.all(
    params.managerEmails.map((to) =>
      sendEmail({
        to,
        subject: `Quotes ready for review: ${params.societyName}`,
        heading: "Quotes ready for review",
        paragraphs: [
          `Quote submission has closed for "${params.requirementName}" — the submitted quotes are ready for your review and recommendation.`,
        ],
        cta: { label: "Review Quotes", url: params.reviewUrl },
      }),
    ),
  );
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
}) {
  const smsBody = `The quote deadline for "${params.requirementName}" closes within 24 hours. Submit your quote: ${params.reviewUrl}`;

  await Promise.all([
    sendEmail({
      to: params.vendorEmail,
      subject: "Quote deadline closing soon",
      heading: "Quote deadline closing soon",
      paragraphs: [`The quote deadline for "${params.requirementName}" closes within 24 hours.`],
      cta: { label: "Submit your quote", url: params.reviewUrl },
    }),
    sendSms({ to: params.vendorPhone, body: `ProSoc: ${smsBody}` }),
  ]);
}
