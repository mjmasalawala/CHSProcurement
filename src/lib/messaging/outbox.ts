import { Prisma } from "@/generated/prisma/client";
import type { MessageCategory } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// The outbox — see Requirements/messaging-and-engagement-spec.md Phase 0.
// Every outbound email is logged as a Message row here instead of going
// straight to Resend, so it has a status, a retry history, and (once
// RESEND_WEBHOOK_SECRET is set) a delivered/read/bounced outcome. lib/
// messaging/dispatcher.ts is what actually sends a row; this file is just
// the write side.

export interface EnqueueEmailParams {
  // Stable per-notification-type key (e.g. "vendor.bid_outcome") — see the
  // message catalog in the spec doc. Not a foreign key, just a tag.
  templateKey: string;
  category?: MessageCategory;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  // A second enqueue with the same dedupeKey is a silent no-op (returns
  // null) — for reminder-style sends that must fire at most once per
  // (recipient, event).
  dedupeKey?: string;
  sendAfter?: Date;
}

/**
 * Creates a QUEUED Message row. Returns the new row's id, or null if
 * dedupeKey collided with an existing row (already enqueued, nothing to do).
 */
export async function enqueueEmail(params: EnqueueEmailParams): Promise<string | null> {
  const to = Array.isArray(params.to) ? params.to : [params.to];

  try {
    const message = await prisma.message.create({
      data: {
        channel: "EMAIL",
        category: params.category ?? "TRANSACTIONAL",
        templateKey: params.templateKey,
        to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        dedupeKey: params.dedupeKey,
        sendAfter: params.sendAfter ?? new Date(),
      },
    });
    return message.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return null;
    }
    throw err;
  }
}

export interface EnqueueWhatsappParams {
  templateKey: string;
  category?: MessageCategory;
  // A single E.164 phone number (lib/whatsapp.ts's toE164India) — unlike
  // email there's no batch-recipient case for a WhatsApp send.
  to: string;
  // Used if the recipient's 24h session window happens to be open (rare for
  // a first-contact message, but cheap to supply so it isn't wasted).
  text: string;
  // Positional {{1}}, {{2}}, ... values for the approved WhatsApp template
  // this templateKey maps to (lib/messaging/whatsapp-templates.ts) — used
  // when the window is closed, which is the common case for a first
  // contact. Omit if this templateKey has no template mapped yet; the
  // dispatcher will just SKIP outside the window until one is added.
  templateParams?: string[];
  dedupeKey?: string;
  sendAfter?: Date;
}

/**
 * Same shape as enqueueEmail, for the WhatsApp channel. What the dispatcher
 * does with this row (lib/messaging/dispatcher.ts) depends on whether the
 * recipient's 24h session window is open, and whether templateKey has an
 * approved WhatsApp template mapped to it — see that file and
 * whatsapp-templates.ts.
 */
export async function enqueueWhatsapp(params: EnqueueWhatsappParams): Promise<string | null> {
  try {
    const message = await prisma.message.create({
      data: {
        channel: "WHATSAPP",
        category: params.category ?? "TRANSACTIONAL",
        templateKey: params.templateKey,
        to: [params.to],
        text: params.text,
        whatsappTemplateParams: params.templateParams ?? [],
        dedupeKey: params.dedupeKey,
        sendAfter: params.sendAfter ?? new Date(),
      },
    });
    return message.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return null;
    }
    throw err;
  }
}
