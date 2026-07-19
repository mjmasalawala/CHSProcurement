// Pragmatic client-side shape check, not full RFC 5322 — this only exists to
// catch obviously-broken input (typos, placeholder junk like "dfdsfsd")
// before it reaches a server action and gets handed to Resend, which
// rejects invalid recipients and previously left registration wizards
// stuck on "Submitting…" (see register/society/actions.ts). Real deliverability
// is only ever proven by the send itself.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}
