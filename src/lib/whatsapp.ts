// WhatsApp OTP delivery via Meta's Cloud API (Graph API) — replaces the SMS
// OTP path (product decision, 2026-07-19: DLT entity/template registration
// for SMS costs ~₹5000+GST and isn't happening right now; WhatsApp template
// approval is free and handled directly by Meta, no DLT involved).
//
// Needs a WhatsApp Business Platform phone number + an approved message
// template. Register the template body as close to this as your template
// category allows:
//   "Your ProSoc verification code is {{1}}. It expires in 10 minutes."
// (Meta's "Authentication" template category has a more rigid, Meta-defined
// body and adds its own security disclaimer/copy-code button — a "Utility"
// category template gives full control over the wording above instead.
// Either works here; whichever you register, its exact name goes in
// WHATSAPP_OTP_TEMPLATE_NAME below.)
//
// Falls back to a console-log stub — same pattern as lib/sms.ts — until
// WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID are configured, so nothing
// here needs to change once real credentials are added.

const GRAPH_API_VERSION = "v21.0";

// WhatsApp needs the full E.164 number (country code, no leading 0/+).
// Every phone number in this app is entered as a bare Indian mobile number
// (10 digits, e.g. seed data "9000000000") — normalize rather than assume
// callers already did this.
function toE164India(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

export async function sendWhatsappOtp(params: { to: string; code: string }): Promise<void> {
  const to = toE164India(params.to);
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME;

  if (!accessToken || !phoneNumberId || !templateName) {
    console.log(`[whatsapp:stub] to=${to} otp=${params.code}`);
    return;
  }

  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: process.env.WHATSAPP_OTP_TEMPLATE_LANG || "en" },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: params.code }],
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`WhatsApp send failed (to: ${to}, status: ${res.status}): ${errorBody}`);
  }
}
