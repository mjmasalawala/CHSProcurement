// SMS channel — society-portal-spec.md / vendor-registration-portal-spec.md
// Section 9 call for Email + SMS on every trigger event. No SMS provider is
// wired up yet (M7 decision, 2026-07-12): this stub keeps every call site
// and event correctly wired now, so swapping in a real Twilio/MSG91 send
// later is a one-function change here, not a re-audit of every trigger.
export async function sendSms(params: { to: string | null | undefined; body: string }): Promise<void> {
  if (!params.to) return;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  if (!sid) {
    console.log(`[sms:stub] to=${params.to} body=${params.body}`);
    return;
  }

  // TODO: real Twilio send once TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER are configured.
}
