import { prisma } from "@/lib/prisma";
import type { ContactPreference } from "@/generated/prisma/client";

// ContactPreference rows are created lazily (first unsubscribe-link visit)
// rather than one per contact up front — see the spec doc's data model
// section. No marketing email exists yet to link one from (Phase 0 has no
// campaigns/sequences), so getByToken is currently reached only if a token
// was already issued some other way; getOrCreate exists for Phase 2/3 to
// call when a marketing send first goes out to a given address.

export async function getOrCreatePreference(email: string): Promise<ContactPreference> {
  const normalized = email.trim().toLowerCase();
  return prisma.contactPreference.upsert({
    where: { email: normalized },
    update: {},
    create: { email: normalized },
  });
}

export async function getPreferenceByToken(token: string): Promise<ContactPreference | null> {
  return prisma.contactPreference.findUnique({ where: { unsubscribeToken: token } });
}

export async function setMarketingSubscribed(token: string, subscribed: boolean): Promise<ContactPreference | null> {
  const pref = await getPreferenceByToken(token);
  if (!pref) return null;

  return prisma.contactPreference.update({
    where: { id: pref.id },
    data: {
      subscribedMarketing: subscribed,
      emailMarketingOptOutAt: subscribed ? null : new Date(),
    },
  });
}

// ── WhatsApp-first contacts (Phase 1) — a phone number that texts in may
// have no known email, so this is a second, independent lookup path into
// the same table (see the schema comment on ContactPreference.email).

/**
 * Best-effort identity resolution: does this phone number belong to a User
 * or VendorCompany we already know the email of? Both store phone as a bare
 * 10-digit Indian mobile number (the app's convention throughout), not
 * WhatsApp's E.164 form, so this strips the "91" country code before
 * comparing.
 */
async function resolveEmailForPhone(phoneE164: string): Promise<string | null> {
  const bare = phoneE164.length === 12 && phoneE164.startsWith("91") ? phoneE164.slice(2) : phoneE164;

  const user = await prisma.user.findFirst({ where: { phone: bare } });
  if (user) return user.email;

  const vendor = await prisma.vendorCompany.findFirst({ where: { ownerPhone: bare } });
  if (vendor) return vendor.ownerEmail;

  return null;
}

/**
 * Gets or creates the ContactPreference row for an inbound WhatsApp
 * message's sender. Tries to resolve a known email first so someone we can
 * actually identify doesn't fork into a second, phone-only row alongside
 * their real one; falls back to a phone-only row for a sender we don't
 * recognize at all.
 */
export async function getOrCreatePreferenceForPhone(phoneE164: string): Promise<ContactPreference> {
  const email = await resolveEmailForPhone(phoneE164);

  if (email) {
    return prisma.contactPreference.upsert({
      where: { email },
      update: { phone: phoneE164 },
      create: { email, phone: phoneE164 },
    });
  }

  return prisma.contactPreference.upsert({
    where: { phone: phoneE164 },
    update: {},
    create: { phone: phoneE164 },
  });
}

export async function setWhatsappOptStatus(phoneE164: string, optedIn: boolean): Promise<ContactPreference> {
  const pref = await getOrCreatePreferenceForPhone(phoneE164);
  const now = new Date();

  return prisma.contactPreference.update({
    where: { id: pref.id },
    data: optedIn ? { whatsappOptInAt: now, whatsappOptOutAt: null } : { whatsappOptOutAt: now },
  });
}
