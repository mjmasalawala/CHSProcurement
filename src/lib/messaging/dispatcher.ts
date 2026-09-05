import { Resend } from "resend";
import type { Message } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isStagingWhatsappRedirectConfigured, isWhatsappMessagingEnabled, sendWhatsappTemplate, sendWhatsappText } from "@/lib/whatsapp";
import { WHATSAPP_TEMPLATES } from "@/lib/messaging/whatsapp-templates";
import { isStagingEnvironment } from "@/lib/environment";

const WHATSAPP_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

// Sends rows from the outbox (lib/messaging/outbox.ts). Two entry points
// into the same send logic, per the spec doc's "how does the dispatcher know
// to send just the urgent one" answer:
//
//  - sendOne(id): sends exactly that row. lib/notifications.ts calls this
//    right after enqueueEmail, in the same request, so a "resend OTP" click
//    still resolves synchronously (throwing on failure) exactly like the old
//    direct-to-Resend sendEmail() did — nothing here changes that contract.
//  - sweep(): the cron-triggered path (/api/cron/dispatch). Claims a batch of
//    everything due and sends each one — this is what picks up rows nobody
//    is actively waiting on (currently: automatic retries of a row sendOne
//    already tried once and failed; Phase 2 adds reminders/sequences here).
//
// sendOne never looks at the rest of the queue; it was only ever given the
// one id it was called with.

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = `Wisesoc <${process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"}>`;

const MAX_ATTEMPTS = 5;

function backoffMs(attempt: number): number {
  // 1m, 2m, 4m, 8m, capped at 30m.
  return Math.min(60_000 * 2 ** (attempt - 1), 30 * 60_000);
}

/**
 * ContactPreference doesn't exist for most contacts yet (rows are created
 * lazily — see lib/messaging/preferences.ts), so "no row found" means "not
 * suppressed", not "unknown, so block it".
 */
async function suppressionReason(to: string[], category: Message["category"]): Promise<string | null> {
  if (to.length === 0) return null;

  const prefs = await prisma.contactPreference.findMany({ where: { email: { in: to } } });
  for (const pref of prefs) {
    if (pref.emailSuppressedAt) return `${pref.email} is suppressed (bounced/complained)`;
    if (category === "MARKETING" && pref.emailMarketingOptOutAt) return `${pref.email} opted out of marketing email`;
  }
  return null;
}

// Now that RESEND_FROM_EMAIL is a verified domain (2026-09-05), Resend
// actually delivers to whoever a Message row names — the sandbox-only
// delivery that used to make this safe by accident is gone. Staging must
// never email a real vendor/society member, so every EMAIL send there is
// redirected to STAGING_EMAIL_REDIRECT_TO instead, with the real intended
// recipient(s) prepended to the subject so it's still obvious what would
// have gone out. Guarded by isStagingEnvironment() (VERCEL_GIT_COMMIT_REF),
// not by whether this env var happens to be set — so if it were ever also
// set in Production by mistake, isStagingEnvironment() being false there
// means it's simply never read. If it's unset while staging, sendMessage
// below refuses to send at all rather than guessing a safe address.
function stagingEmailRedirectTo(): string | undefined {
  return process.env.STAGING_EMAIL_REDIRECT_TO;
}

async function deliverEmail(message: Message): Promise<{ providerId?: string }> {
  // subject/html/text are nullable on Message only to leave room for a
  // future non-email channel row — enqueueEmail (the only writer of EMAIL
  // rows) always sets all three, so this is safe.
  const redirectTo = isStagingEnvironment() ? stagingEmailRedirectTo() : undefined;
  const redirecting = Boolean(redirectTo);
  const to = redirectTo ? [redirectTo] : message.to;
  const subject = redirecting ? `[STAGING → ${message.to.join(", ")}] ${message.subject}` : message.subject!;

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html: message.html!,
    text: message.text!,
  });
  if (error) {
    throw new Error(`Resend send failed (to: ${to.join(", ")}, subject: "${subject}"): ${error.message}`);
  }
  return { providerId: data?.id };
}

/**
 * A phone opted out of WhatsApp entirely (the "Stop messages" button, or
 * the STOP keyword — see inbound-triage.ts) blocks every category, same as
 * an email hard-bounce — someone who asked to stop shouldn't still get
 * "transactional" WhatsApp messages.
 */
async function whatsappSuppressionReason(to: string): Promise<string | null> {
  const pref = await prisma.contactPreference.findUnique({ where: { phone: to } });
  if (!pref?.whatsappOptOutAt) return null;
  const stillOptedOut = !pref.whatsappOptInAt || pref.whatsappOptOutAt > pref.whatsappOptInAt;
  return stillOptedOut ? `${to} opted out of WhatsApp messages` : null;
}

/**
 * Sends via free text if the recipient's 24h customer-service window is
 * open (their Conversation.lastInboundAt is recent — see the WhatsApp
 * webhook, which stamps it on every inbound message); otherwise SKIPS with
 * a clear reason, since reaching them outside the window needs an approved
 * message template and none exist yet (Requirements/messaging-and-
 * engagement-spec.md Section 3.1 — templates are a separate Meta approval
 * per wording, not something this dispatcher can improvise around).
 */
async function deliverWhatsapp(message: Message): Promise<{ providerId?: string } | { skipped: string }> {
  const to = message.to[0];
  if (!to) return { skipped: "No recipient phone number." };

  const conversation = await prisma.conversation.findUnique({ where: { phoneE164: to } });
  const withinWindow = conversation?.lastInboundAt && Date.now() - conversation.lastInboundAt.getTime() < WHATSAPP_SESSION_WINDOW_MS;

  if (withinWindow) {
    const result = await sendWhatsappText({ to, body: message.text ?? "" });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastOutboundAt: new Date() } });
    return result;
  }

  // Outside the window — most sends are (a first contact has never
  // messaged us) — so free text is off the table; only an approved
  // template mapped to this templateKey can reach them. See
  // whatsapp-templates.ts.
  const template = WHATSAPP_TEMPLATES[message.templateKey];
  if (!template) {
    return { skipped: "Outside the 24h session window — no approved WhatsApp template mapped for this templateKey yet." };
  }

  return sendWhatsappTemplate({
    to,
    templateName: template.name,
    languageCode: template.language,
    bodyParams: message.whatsappTemplateParams,
  });
}

async function recordFailure(message: Message, err: unknown): Promise<"FAILED"> {
  const attempts = message.attempts + 1;
  const exhausted = attempts >= MAX_ATTEMPTS;
  const errorText = err instanceof Error ? err.message : String(err);

  await prisma.message.update({
    where: { id: message.id },
    data: {
      status: exhausted ? "FAILED" : "QUEUED",
      attempts,
      error: errorText,
      sendAfter: exhausted ? message.sendAfter : new Date(Date.now() + backoffMs(attempts)),
    },
  });

  if (exhausted) return "FAILED";
  throw err;
}

/**
 * Sends one row, or returns "SKIPPED" without throwing if another sender
 * already claimed it (belt-and-braces against sendOne and sweep racing on
 * the same row) or if it's suppressed/outside the WhatsApp session window.
 * On a genuine send failure that hasn't exhausted retries, this throws —
 * sendOne's caller sees the failure immediately (see file header), and the
 * row is left QUEUED with a backed-off sendAfter for the next sweep to
 * retry.
 */
async function sendMessage(message: Message): Promise<"SENT" | "FAILED" | "SKIPPED"> {
  const claimed = await prisma.message.updateMany({
    where: { id: message.id, status: "QUEUED" },
    data: { status: "SENDING" },
  });
  if (claimed.count === 0) return "SKIPPED";

  if (message.channel === "EMAIL") {
    if (isStagingEnvironment() && !stagingEmailRedirectTo()) {
      await prisma.message.update({
        where: { id: message.id },
        data: { status: "SKIPPED", skippedReason: "Staging: STAGING_EMAIL_REDIRECT_TO isn't set — refusing to send a real email in staging." },
      });
      return "SKIPPED";
    }

    const skipReason = await suppressionReason(message.to, message.category);
    if (skipReason) {
      await prisma.message.update({ where: { id: message.id }, data: { status: "SKIPPED", skippedReason: skipReason } });
      return "SKIPPED";
    }

    try {
      const { providerId } = await deliverEmail(message);
      await prisma.message.update({
        where: { id: message.id },
        data: { status: "SENT", providerId, sentAt: new Date(), attempts: { increment: 1 } },
      });
      return "SENT";
    } catch (err) {
      return recordFailure(message, err);
    }
  }

  // channel === "WHATSAPP"
  if (!isWhatsappMessagingEnabled()) {
    await prisma.message.update({
      where: { id: message.id },
      data: { status: "SKIPPED", skippedReason: "WhatsApp messaging is disabled (WHATSAPP_MESSAGING_ENABLED)." },
    });
    return "SKIPPED";
  }

  if (!isStagingWhatsappRedirectConfigured()) {
    await prisma.message.update({
      where: { id: message.id },
      data: { status: "SKIPPED", skippedReason: "Staging: STAGING_WHATSAPP_REDIRECT_TO isn't set — refusing to send a real WhatsApp message in staging." },
    });
    return "SKIPPED";
  }

  const to = message.to[0];
  const skipReason = to ? await whatsappSuppressionReason(to) : "No recipient phone number.";
  if (skipReason) {
    await prisma.message.update({ where: { id: message.id }, data: { status: "SKIPPED", skippedReason: skipReason } });
    return "SKIPPED";
  }

  try {
    const result = await deliverWhatsapp(message);
    if ("skipped" in result) {
      await prisma.message.update({ where: { id: message.id }, data: { status: "SKIPPED", skippedReason: result.skipped } });
      return "SKIPPED";
    }
    await prisma.message.update({
      where: { id: message.id },
      data: { status: "SENT", providerId: result.providerId, sentAt: new Date(), attempts: { increment: 1 } },
    });
    return "SENT";
  } catch (err) {
    return recordFailure(message, err);
  }
}

export async function sendOne(messageId: string): Promise<void> {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.status !== "QUEUED") return;
  await sendMessage(message);
}

export async function sweep(limit = 50): Promise<{ sent: number; failed: number; skipped: number }> {
  const due = await prisma.message.findMany({
    where: { status: "QUEUED", sendAfter: { lte: new Date() } },
    orderBy: { sendAfter: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const message of due) {
    try {
      const result = await sendMessage(message);
      if (result === "SENT") sent++;
      else if (result === "SKIPPED") skipped++;
      else failed++;
    } catch {
      // sendMessage throws on a non-final failure so sendOne's synchronous
      // caller sees it — sweep already recorded the retry/backoff before
      // throwing, so here it's just a failed-this-round count.
      failed++;
    }
  }

  return { sent, failed, skipped };
}
