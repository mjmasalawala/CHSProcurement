import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySvixSignature } from "@/lib/messaging/webhook-verify";

/**
 * Resend's webhook — delivery status back into the outbox (Message rows)
 * and bounce/complaint suppression into ContactPreference. See
 * Requirements/messaging-and-engagement-spec.md, "Email rules that shape
 * the design". Configure the endpoint URL + copy the signing secret into
 * RESEND_WEBHOOK_SECRET from https://resend.com/webhooks once a sending
 * domain is set up; until then this route 501s rather than trusting an
 * unsigned payload.
 */
interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    to?: string[];
    subject?: string;
    bounce?: { message?: string };
  };
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "RESEND_WEBHOOK_SECRET is not configured" }, { status: 501 });
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  const body = await request.text();

  if (
    !svixId ||
    !svixTimestamp ||
    !svixSignature ||
    !verifySvixSignature({ secret, svixId, svixTimestamp, svixSignature, body })
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: ResendWebhookPayload;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // svix-id is unique per delivery attempt, so retried deliveries of the
  // same event are a no-op here rather than double-processed.
  try {
    await prisma.webhookEvent.create({
      data: { provider: "RESEND", eventId: svixId, eventType: event.type, payload: body },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: true, deduped: true });
    }
    throw err;
  }

  await processResendEvent(event);
  await prisma.webhookEvent.update({ where: { provider_eventId: { provider: "RESEND", eventId: svixId } }, data: { processedAt: new Date() } });

  return NextResponse.json({ ok: true });
}

async function processResendEvent(event: ResendWebhookPayload): Promise<void> {
  const emailId = event.data.email_id;

  switch (event.type) {
    case "email.delivered": {
      if (emailId) {
        await prisma.message.updateMany({ where: { providerId: emailId }, data: { status: "DELIVERED", deliveredAt: new Date() } });
      }
      break;
    }
    case "email.opened": {
      // Message.readAt doubles as "opened" for email — see the schema
      // comment on Message.status; WhatsApp's read-receipt semantics are
      // the same idea, so one column serves both channels.
      if (emailId) {
        await prisma.message.updateMany({ where: { providerId: emailId }, data: { status: "READ", readAt: new Date() } });
      }
      break;
    }
    case "email.bounced": {
      if (emailId) {
        await prisma.message.updateMany({
          where: { providerId: emailId },
          data: { status: "FAILED", error: event.data.bounce?.message ?? "Bounced" },
        });
      }
      await suppress(event.data.to ?? [], event.data.bounce?.message ?? "Hard bounce");
      break;
    }
    case "email.complained": {
      await suppress(event.data.to ?? [], "Recipient marked the email as spam");
      break;
    }
    default:
      // email.sent / email.delivery_delayed / email.clicked and anything
      // else — recorded in WebhookEvent above, no Message/ContactPreference
      // side effect yet. Click tracking needs the TrackedLink redirect
      // mechanism (Phase 2), not something to bolt on here.
      break;
  }
}

async function suppress(emails: string[], reason: string): Promise<void> {
  const now = new Date();
  for (const email of emails) {
    const normalized = email.trim().toLowerCase();
    const data = { emailSuppressedAt: now, suppressionReason: reason, subscribedMarketing: false, emailMarketingOptOutAt: now };
    await prisma.contactPreference.upsert({
      where: { email: normalized },
      update: data,
      create: { email: normalized, ...data },
    });
  }
}
