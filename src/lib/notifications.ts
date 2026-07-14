import { Resend } from "resend";
import { sendSms } from "@/lib/sms";

const resend = new Resend(process.env.RESEND_API_KEY);

// Falls back to Resend's shared sandbox sender, which only delivers to the
// account owner's own verified address (SUPPORT_EMAIL) — set RESEND_FROM_EMAIL
// to a verified-domain address (e.g. "ProSoc <notifications@yourdomain.com>")
// once a sending domain is verified in Resend, to unlock real delivery.
const FROM = process.env.RESEND_FROM_EMAIL ?? "ProSoc <onboarding@resend.dev>";

/**
 * The Resend SDK does NOT throw on API-level failures (invalid/unverified
 * sending domain, bad recipient, etc.) — it resolves with { data, error }.
 * Every call site in this file used to call resend.emails.send() directly
 * and ignore that error field entirely, so a rejected send (e.g. the "from"
 * domain failing verification) silently did nothing: no exception, no log,
 * callers proceeded as if the email went out. Routing every send through
 * here makes that failure loud instead of silent.
 */
async function sendEmail(params: { to: string | string[]; subject: string; text: string }) {
  const { error } = await resend.emails.send({ from: FROM, ...params });
  if (error) {
    throw new Error(`Resend send failed (to: ${params.to}, subject: "${params.subject}"): ${error.message}`);
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
    text: `A new ${params.type} has registered on ProSoc and is pending verification.

Name: ${params.name}
Contact: ${params.contactName} <${params.contactEmail}>

Review and approve: ${params.approveUrl}`,
  });
}

// Note: while RESEND_API_KEY is sandboxed, this — like notifyRejection —
// won't actually reach a real invitee's inbox until a sending domain is
// verified (Resend only delivers to the account owner's own address).
export async function sendInvite(params: {
  email: string;
  role: string;
  entityName: string | null;
  url: string;
}) {
  const forWhat = params.entityName ? ` for ${params.entityName}` : "";
  await sendEmail({
    to: params.email,
    subject: `You've been invited to ProSoc as ${params.role}`,
    text: `Hi,

You've been invited to join ProSoc as ${params.role}${forWhat}.

Accept the invite and set up your login here: ${params.url}

This link expires in 7 days.`,
  });
}

// Same Resend sandbox caveat as sendInvite/notifyRejection.
export async function sendPasswordReset(params: { email: string; url: string }) {
  await sendEmail({
    to: params.email,
    subject: "Reset your ProSoc password",
    text: `Hi,

We received a request to reset your ProSoc password. Set a new one here: ${params.url}

This link expires in 1 hour. If you didn't request this, you can ignore this email.`,
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
        text: `Hi,

A quotation for "${params.requirementName}" needs your approval (2 of 3 Office Bearers required) — it's at or above ${params.societyName}'s approval threshold.

Review and vote: ${params.reviewUrl}`,
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
        text: `Hi,

The quotation for "${params.requirementName}" has been finalized. Work Order ${params.workOrderNumber} has been generated.

View it here: ${params.reviewUrl}`,
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
    text: `Hi,

The recommendation for "${params.requirementName}" was rejected by 2 of the 3 Office Bearers. It's been sent back to you to re-recommend or re-open quoting.

Review it here: ${params.reviewUrl}`,
  });
}

export async function notifyBidOutcome(params: {
  vendorEmail: string;
  vendorPhone?: string | null;
  requirementName: string;
  won: boolean;
}) {
  const body = params.won
    ? `Congratulations — your quote for "${params.requirementName}" was selected. Check My Quotes / History on ProSoc for the Work Order.`
    : `Your quote for "${params.requirementName}" was not selected this time. Check My Quotes / History on ProSoc for details.`;

  await Promise.all([
    sendEmail({
      to: params.vendorEmail,
      subject: params.won ? "You were selected on ProSoc" : "Quote outcome on ProSoc",
      text: body,
    }),
    sendSms({ to: params.vendorPhone, body }),
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
        text: `Hi,

${params.proposerName} proposed changing ${params.societyName}'s approval threshold from ₹${params.oldValue} to ₹${params.newValue}. One other Office Bearer's approval is needed.

Review it here: ${params.reviewUrl}`,
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
    text: `Hi,

Your proposed threshold change (₹${params.oldValue} → ₹${params.newValue}) for ${params.societyName} was ${
      params.approved ? "approved" : "rejected"
    } by ${params.deciderName}.`,
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
        text: `Hi,

${params.proposerName} proposed removing ${params.targetName} from ${params.societyName}. One other Office Bearer's approval is needed.

Review it here: ${params.reviewUrl}`,
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
    text: `Hi,

Your proposal to remove ${params.targetName} from ${params.societyName} was ${
      params.approved ? "approved" : "rejected"
    } by ${params.deciderName}.`,
  });
}

// Sent to the removed person themselves once the removal is approved — their
// ProSoc login still exists (other role assignments, if any, are untouched),
// they just lose access to this specific society.
export async function notifyMemberRemoved(params: { email: string; societyName: string }) {
  await sendEmail({
    to: params.email,
    subject: `Removed from ${params.societyName} on ProSoc`,
    text: `Hi,

You've been removed from ${params.societyName} on ProSoc and no longer have access to that workspace. If you believe this was a mistake, please get in touch with the society directly.`,
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
    text: `Hi,

You've been added as ${params.role}${forWhat} on ProSoc, using your existing account (${params.email}).

Log in here: ${params.loginUrl}`,
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
  const body = `Your ${params.type} registration for "${params.name}" was not approved. Reason: ${
    params.reason || "No reason provided."
  } If you believe this was a mistake or would like to re-apply with corrected details, please get in touch with ProSoc support.`;

  await Promise.all([
    sendEmail({
      to: params.contactEmail,
      subject: `Your ${params.type} registration on ProSoc`,
      text: `Hi,

${body}`,
    }),
    sendSms({ to: params.contactPhone, body: `ProSoc: ${body}` }),
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
      text: `Hi,

${body}`,
    }),
    sendSms({ to: params.contactPhone, body: `ProSoc: ${body}` }),
  ]);
}

// M7 — registration approval (currently only wired for Vendors: Society
// approval already implicitly notifies the Secretary via the activation
// invite email in admin/societies/[id]/actions.ts).
export async function notifyApproval(params: {
  type: "Society" | "Vendor";
  name: string;
  contactEmail: string;
  contactPhone?: string | null;
}) {
  const body = `Good news — your ${params.type} registration for "${params.name}" on ProSoc has been approved and is now active.`;

  await Promise.all([
    sendEmail({
      to: params.contactEmail,
      subject: `Your ${params.type} registration was approved`,
      text: `Hi,

${body}`,
    }),
    sendSms({ to: params.contactPhone, body: `ProSoc: ${body}` }),
  ]);
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
  const body = `A new ${params.categoryName} requirement from ${params.societyName} matches your profile. Submit your quote: ${params.reviewUrl}`;

  await Promise.all([
    sendEmail({
      to: params.vendorEmail,
      subject: `New requirement matched: ${params.categoryName}`,
      text: `Hi,

${body}`,
    }),
    sendSms({ to: params.vendorPhone, body: `ProSoc: ${body}` }),
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
  const list = params.requirements
    .map((r) => `- ${r.categoryName} for ${r.societyName}`)
    .join("\n");
  const body = `You've been matched with ${count} new requirement${count === 1 ? "" : "s"} that fit your profile:\n\n${list}\n\nCheck your dashboard and submit your quotes: ${params.dashboardUrl}`;

  await Promise.all([
    sendEmail({
      to: params.vendorEmail,
      subject: `You've been matched with ${count} new requirement${count === 1 ? "" : "s"}`,
      text: `Hi,

${body}`,
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
      text: `Hi,

${body}`,
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
        text: `Hi,

The quote deadline for "${params.requirementName}" closes within 24 hours.

Review it here: ${params.reviewUrl}`,
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
        text: `Hi,

Quote submission has closed for "${params.requirementName}" — the submitted quotes are ready for your review and recommendation.

Review it here: ${params.reviewUrl}`,
      }),
    ),
  );
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
  const body = `The quote deadline for "${params.requirementName}" closes within 24 hours. Submit your quote: ${params.reviewUrl}`;

  await Promise.all([
    sendEmail({
      to: params.vendorEmail,
      subject: "Quote deadline closing soon",
      text: `Hi,

${body}`,
    }),
    sendSms({ to: params.vendorPhone, body: `ProSoc: ${body}` }),
  ]);
}
