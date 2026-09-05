import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import type { InboundHandledBy, InboundMessageType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { isWhatsappMessagingEnabled, sendWhatsappText } from "@/lib/whatsapp";
import { triageInbound } from "@/lib/messaging/inbound-triage";
import { setWhatsappOptStatus } from "@/lib/messaging/preferences";

/**
 * Meta's WhatsApp Cloud API webhook — both directions of Phase 1's inbound
 * side (Requirements/messaging-and-engagement-spec.md, "Conversations +
 * Inbox"): GET is Meta's one-time callback-URL verification challenge when
 * you register this URL in the app dashboard's WhatsApp → Configuration
 * tab; POST is every subsequent delivery status and inbound message.
 *
 * Signing scheme is plain HMAC-SHA256 over the raw body with the app
 * secret, hex-encoded, in an X-Hub-Signature-256 header — a different
 * scheme from Resend's Svix signing (see lib/messaging/webhook-verify.ts),
 * so this route verifies it directly rather than sharing that helper.
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

function verifySignature(body: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(body).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(header.slice("sha256=".length), "hex");
  return providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);
}

interface WhatsappMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  button?: { text: string; payload: string };
  interactive?: {
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
}

interface WhatsappStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  errors?: { title?: string }[];
}

interface WhatsappWebhookPayload {
  entry?: {
    changes?: {
      value?: {
        messages?: WhatsappMessage[];
        statuses?: WhatsappStatus[];
      };
    }[];
  }[];
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json({ error: "WHATSAPP_APP_SECRET is not configured" }, { status: 501 });
  }

  const body = await request.text();
  if (!verifySignature(body, request.headers.get("x-hub-signature-256"), appSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Meta doesn't hand out one event id per delivery the way Resend/Svix
  // does — a hash of the exact payload is the next best idempotency key
  // (an identical redelivery hashes the same; per-message/per-status
  // idempotency is also enforced below at the row level, which is the
  // finer-grained guarantee that actually matters).
  const eventId = createHash("sha256").update(body).digest("hex");
  try {
    await prisma.webhookEvent.create({ data: { provider: "WHATSAPP", eventId, eventType: "callback", payload: body } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: true, deduped: true });
    }
    throw err;
  }

  const payload: WhatsappWebhookPayload = JSON.parse(body);
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        await processStatus(status);
      }
      for (const message of change.value?.messages ?? []) {
        await processInboundMessage(message);
      }
    }
  }

  await prisma.webhookEvent.update({ where: { provider_eventId: { provider: "WHATSAPP", eventId } }, data: { processedAt: new Date() } });
  return NextResponse.json({ ok: true });
}

async function processStatus(status: WhatsappStatus): Promise<void> {
  const data =
    status.status === "delivered"
      ? { status: "DELIVERED" as const, deliveredAt: new Date() }
      : status.status === "read"
        ? { status: "READ" as const, readAt: new Date() }
        : status.status === "failed"
          ? { status: "FAILED" as const, error: status.errors?.[0]?.title ?? "WhatsApp delivery failed" }
          : null;
  if (!data) return; // "sent" — already SENT at enqueue-send time, nothing new to record.

  await prisma.message.updateMany({ where: { providerId: status.id }, data });
}

function classifyMessage(message: WhatsappMessage): { type: InboundMessageType; text: string | null; buttonPayload: string | null } {
  if (message.type === "text") return { type: "TEXT", text: message.text?.body ?? null, buttonPayload: null };
  if (message.type === "button") return { type: "BUTTON", text: message.button?.text ?? null, buttonPayload: message.button?.payload ?? null };
  if (message.type === "interactive") {
    const reply = message.interactive?.button_reply ?? message.interactive?.list_reply;
    return { type: "INTERACTIVE", text: reply?.title ?? null, buttonPayload: reply?.id ?? null };
  }
  if (["image", "video", "audio", "document", "sticker", "location"].includes(message.type)) {
    return { type: "MEDIA", text: null, buttonPayload: null };
  }
  return { type: "OTHER", text: null, buttonPayload: null };
}

async function processInboundMessage(message: WhatsappMessage): Promise<void> {
  const { type, text, buttonPayload } = classifyMessage(message);

  const conversation = await prisma.conversation.upsert({
    where: { phoneE164: message.from },
    update: { lastInboundAt: new Date() },
    create: { phoneE164: message.from, lastInboundAt: new Date() },
  });

  let inboundId: string;
  try {
    const inbound = await prisma.inboundMessage.create({
      data: { conversationId: conversation.id, providerMessageId: message.id, type, text, buttonPayload },
    });
    inboundId = inbound.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return; // already processed
    throw err;
  }

  const triage = triageInbound({ buttonPayload, text });

  if (triage.intent === "UNKNOWN") {
    await prisma.$transaction([
      prisma.inboundMessage.update({ where: { id: inboundId }, data: { handledBy: "UNHANDLED", intent: "UNKNOWN" } }),
      prisma.conversation.update({ where: { id: conversation.id }, data: { status: "NEEDS_HUMAN" } }),
    ]);
    return;
  }

  await setWhatsappOptStatus(message.from, triage.intent === "OPT_IN");

  const handledBy: InboundHandledBy = "AUTO_RULE";
  await prisma.inboundMessage.update({
    where: { id: inboundId },
    data: { handledBy, intent: triage.intent, autoReplyText: triage.autoReplyText },
  });

  // The opt-in/opt-out itself (setWhatsappOptStatus above) already landed
  // regardless of this check — only the confirmation text is gated, so
  // disabling messaging can't also block someone's opt-out from taking
  // effect. Checked explicitly (rather than letting sendWhatsappText's own
  // guard throw) so a disabled kill switch doesn't turn into a 500 here —
  // that would make Meta retry the whole webhook delivery for a state that
  // isn't going to change on retry.
  if (triage.autoReplyText && isWhatsappMessagingEnabled()) {
    // Safe to send free text here regardless of the 24h window check the
    // dispatcher otherwise enforces — this message just opened/refreshed
    // the window by arriving.
    await sendWhatsappText({ to: message.from, body: triage.autoReplyText });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastOutboundAt: new Date() } });
  }
}
