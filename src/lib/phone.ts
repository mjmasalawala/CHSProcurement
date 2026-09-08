// Pure phone-number formatting — zero imports, safe to use from both server
// actions and client components (unlike lib/whatsapp.ts, which pulls in
// server-only send logic and secrets-adjacent config).

// WhatsApp needs the full E.164 number (country code, no leading 0/+).
// Every phone number in this app is entered as a bare Indian mobile number
// (10 digits, e.g. seed data "9000000000") — normalize rather than assume
// callers already did this. Also the single normalizer every phone-writing
// form action runs input through before a Prisma write, so "9970852786" and
// "+919970852786" (or any other punctuation the user typed) always end up
// stored identically — see phone-verification.ts and friends. Exported since
// Conversation.phoneE164 (Phase 1) is always produced by this function, so a
// conversation is found under one consistent key regardless of how the
// number was typed elsewhere.
export function toE164India(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

/** True only for a number toE164India could fully normalize (91 + 10 digits) — anything else (too short, too long, garbage) is not a usable Indian mobile number. */
export function isValidIndianPhone(phone: string): boolean {
  return toE164India(phone).length === 12;
}
