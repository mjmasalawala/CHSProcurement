import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Resend's sandbox sender works without domain verification but can only
// deliver to the account owner's own verified address (SUPPORT_EMAIL).
const FROM = "ProSoc <onboarding@resend.dev>";

export async function notifyNewRegistration(params: {
  type: "Society" | "Vendor";
  name: string;
  contactName: string;
  contactEmail: string;
  approveUrl: string;
}) {
  const supportEmail = process.env.SUPPORT_EMAIL;
  if (!supportEmail) return;

  await resend.emails.send({
    from: FROM,
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
  await resend.emails.send({
    from: FROM,
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
  await resend.emails.send({
    from: FROM,
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
  requirementDescription: string;
  reviewUrl: string;
}) {
  await Promise.all(
    params.recipients.map((to) =>
      resend.emails.send({
        from: FROM,
        to,
        subject: `Approval needed: ${params.societyName}`,
        text: `Hi,

A quotation for "${params.requirementDescription}" needs your approval (2 of 3 Office Bearers required) — it's at or above ${params.societyName}'s approval threshold.

Review and vote: ${params.reviewUrl}`,
      }),
    ),
  );
}

export async function notifyFinalized(params: {
  recipients: string[];
  societyName: string;
  requirementDescription: string;
  workOrderNumber: string;
  reviewUrl: string;
}) {
  await Promise.all(
    params.recipients.map((to) =>
      resend.emails.send({
        from: FROM,
        to,
        subject: `Quotation finalized: ${params.societyName}`,
        text: `Hi,

The quotation for "${params.requirementDescription}" has been finalized. Work Order ${params.workOrderNumber} has been generated.

View it here: ${params.reviewUrl}`,
      }),
    ),
  );
}

export async function notifyReturnedToManager(params: {
  managerEmail: string;
  societyName: string;
  requirementDescription: string;
  reviewUrl: string;
}) {
  await resend.emails.send({
    from: FROM,
    to: params.managerEmail,
    subject: `Requirement sent back to you: ${params.societyName}`,
    text: `Hi,

The recommendation for "${params.requirementDescription}" was rejected by 2 of the 3 Office Bearers. It's been sent back to you to re-recommend or re-open bidding.

Review it here: ${params.reviewUrl}`,
  });
}

export async function notifyBidOutcome(params: {
  vendorEmail: string;
  requirementDescription: string;
  won: boolean;
}) {
  await resend.emails.send({
    from: FROM,
    to: params.vendorEmail,
    subject: params.won ? "You won a bid on ProSoc" : "Bid outcome on ProSoc",
    text: params.won
      ? `Congratulations — your bid for "${params.requirementDescription}" was selected. Check My Bids / History on ProSoc for the Work Order.`
      : `Your bid for "${params.requirementDescription}" was not selected this time. Check My Bids / History on ProSoc for details.`,
  });
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
      resend.emails.send({
        from: FROM,
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
  await resend.emails.send({
    from: FROM,
    to: params.proposerEmail,
    subject: `Threshold change ${params.approved ? "approved" : "rejected"}: ${params.societyName}`,
    text: `Hi,

Your proposed threshold change (₹${params.oldValue} → ₹${params.newValue}) for ${params.societyName} was ${
      params.approved ? "approved" : "rejected"
    } by ${params.deciderName}.`,
  });
}

// Note: while RESEND_API_KEY is sandboxed (no verified sending domain),
// Resend only delivers to the account owner's own verified address — this
// won't actually reach the applicant's inbox until a domain is verified.
export async function notifyRejection(params: {
  type: "Society" | "Vendor";
  name: string;
  contactEmail: string;
  reason: string;
}) {
  await resend.emails.send({
    from: FROM,
    to: params.contactEmail,
    subject: `Your ${params.type} registration on ProSoc`,
    text: `Hi,

Your ${params.type} registration for "${params.name}" was not approved.

Reason: ${params.reason || "No reason provided."}

If you believe this was a mistake or would like to re-apply with corrected details, please get in touch with ProSoc support.`,
  });
}
