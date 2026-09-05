// WhatsApp Cloud API (Meta) — OTP delivery (sendWhatsappOtp, replacing SMS —
// product decision, 2026-07-19) plus the generic send functions the outbox
// dispatcher (lib/messaging/dispatcher.ts) and inbound webhook
// (app/api/webhooks/whatsapp) use for Phase 1. See
// Requirements/messaging-and-engagement-spec.md.
//
// Falls back to a console-log stub — same pattern as lib/sms.ts — until
// WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID are configured.

const GRAPH_API_VERSION = "v21.0";

/**
 * Kill switch (2026-09-05, product decision) for every non-OTP outbound
 * WhatsApp send — sendWhatsappTemplate/sendWhatsappText below, which is
 * everything the outbox dispatcher and the inbound webhook's auto-reply
 * use. OTP (sendWhatsappOtp) is deliberately NOT gated by this — it's
 * already relied on for phone verification and was live before this
 * platform existed.
 *
 * Defaults OFF (anything other than the literal string "true" is
 * disabled) specifically so deploying this code — merging Phase 1, a
 * preview build, a future campaign feature — can never itself be the
 * thing that starts messaging real users. Going live is a deliberate flip
 * of this one env var in Vercel, not a side effect of a deploy.
 *
 * Both sendWhatsappTemplate and sendWhatsappText check this themselves
 * (rather than trusting every future caller to check it first) so a
 * careless new call site — an admin "send test" button, a campaign sender
 * that doesn't exist yet — can't accidentally bypass it. Callers that want
 * a clean SKIPPED/no-op instead of a thrown error should still check
 * isWhatsappMessagingEnabled() themselves first — see dispatcher.ts and
 * the webhook route for how.
 */
export function isWhatsappMessagingEnabled(): boolean {
  return process.env.WHATSAPP_MESSAGING_ENABLED === "true";
}

class WhatsappMessagingDisabledError extends Error {
  constructor() {
    super('WhatsApp messaging is disabled (WHATSAPP_MESSAGING_ENABLED is not "true").');
    this.name = "WhatsappMessagingDisabledError";
  }
}

// WhatsApp needs the full E.164 number (country code, no leading 0/+).
// Every phone number in this app is entered as a bare Indian mobile number
// (10 digits, e.g. seed data "9000000000") — normalize rather than assume
// callers already did this. Exported since Conversation.phoneE164 (Phase 1)
// is always produced by this function, so a conversation is found under one
// consistent key regardless of how the number was typed elsewhere.
export function toE164India(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

interface GraphCredentials {
  accessToken: string;
  phoneNumberId: string;
}

function getCredentials(): GraphCredentials | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) return null;
  return { accessToken, phoneNumberId };
}

async function postToGraph(credentials: GraphCredentials, body: Record<string, unknown>): Promise<{ providerId?: string }> {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${credentials.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`WhatsApp send failed (status: ${res.status}): ${errorBody}`);
  }

  const data = (await res.json()) as { messages?: { id?: string }[] };
  return { providerId: data.messages?.[0]?.id };
}

export async function sendWhatsappOtp(params: { to: string; code: string }): Promise<void> {
  const to = toE164India(params.to);
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME;
  const credentials = getCredentials();

  if (!credentials || !templateName) {
    console.log(`[whatsapp:stub] to=${to} otp=${params.code}`);
    return;
  }

  // OTP/verification-code content must use Meta's AUTHENTICATION template
  // category — a UTILITY submission gets auto-rejected with
  // INCORRECT_CATEGORY regardless of wording (confirmed 2026-09-05).
  // Authentication templates have Meta-fixed body wording (only
  // add_security_recommendation/code_expiration_minutes are configurable at
  // creation) plus a "Copy Code" button. Despite the button being created
  // as otp_type COPY_CODE, Meta stores/sends it as a URL-type button whose
  // url has an "otp{{1}}" placeholder (confirmed by inspecting the created
  // template's components) — so the send-time button component needs
  // sub_type "url" with a plain text parameter, NOT sub_type "copy_code"/
  // coupon_code as Meta's older docs describe for this otp_type.
  await postToGraph(credentials, {
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: process.env.WHATSAPP_OTP_TEMPLATE_LANG || "en" },
      components: [
        { type: "body", parameters: [{ type: "text", text: params.code }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: params.code }] },
      ],
    },
  });
}

/**
 * Sends an approved WhatsApp message template — the only way to reach a
 * contact outside the 24h customer-service window (see dispatcher.ts). No
 * custom templates are submitted/approved yet as of Phase 1's initial
 * build — this exists so the dispatcher and a future admin "Create
 * template" flow (Requirements/messaging-and-engagement-spec.md, Section
 * 3.1) have something to call the moment one is. Params are positional
 * body placeholders ({{1}}, {{2}}, ...), matching Meta's template format.
 */
export async function sendWhatsappTemplate(params: {
  to: string;
  templateName: string;
  languageCode: string;
  bodyParams?: string[];
}): Promise<{ providerId?: string }> {
  if (!isWhatsappMessagingEnabled()) throw new WhatsappMessagingDisabledError();

  const to = toE164India(params.to);
  const credentials = getCredentials();

  if (!credentials) {
    console.log(`[whatsapp:stub] template=${params.templateName} to=${to} params=${JSON.stringify(params.bodyParams)}`);
    return {};
  }

  return postToGraph(credentials, {
    to,
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.languageCode },
      ...(params.bodyParams?.length
        ? { components: [{ type: "body", parameters: params.bodyParams.map((text) => ({ type: "text", text })) }] }
        : {}),
    },
  });
}

/**
 * Free-form text — only deliverable within 24h of the contact's last
 * inbound message (Meta's rule). Callers (dispatcher.ts, the inbound
 * webhook's auto-reply) are responsible for checking that window first;
 * Meta itself will reject the call otherwise, which surfaces here as a
 * thrown error same as any other send failure.
 */
export async function sendWhatsappText(params: { to: string; body: string }): Promise<{ providerId?: string }> {
  if (!isWhatsappMessagingEnabled()) throw new WhatsappMessagingDisabledError();

  const to = toE164India(params.to);
  const credentials = getCredentials();

  if (!credentials) {
    console.log(`[whatsapp:stub] text to=${to} body=${params.body}`);
    return {};
  }

  return postToGraph(credentials, { to, type: "text", text: { body: params.body } });
}
