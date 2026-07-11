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
