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
