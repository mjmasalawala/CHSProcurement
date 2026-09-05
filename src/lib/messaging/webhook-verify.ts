import { createHmac, timingSafeEqual } from "node:crypto";

// Resend (and, in Phase 1, Meta's WhatsApp Cloud API webhook) both sign
// their webhook POST bodies — Resend using the Svix scheme specifically.
// This verifies a Svix-signed payload; see
// https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests.
//
// Svix scheme: secret is "whsec_<base64>"; the signed content is
// "<svix-id>.<svix-timestamp>.<raw body>", HMAC-SHA256'd with the decoded
// secret, base64-encoded; the svix-signature header carries one or more
// space-separated "v1,<base64 signature>" values (key rotation support) —
// a match against any one of them is a valid signature.
export function verifySvixSignature(params: {
  secret: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  body: string;
  // Reject anything older than this to blunt replay of a captured payload.
  toleranceSeconds?: number;
}): boolean {
  const { secret, svixId, svixTimestamp, svixSignature, body, toleranceSeconds = 5 * 60 } = params;

  const timestamp = Number(svixTimestamp);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) {
    return false;
  }

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  const expectedBuf = Buffer.from(expected);

  return svixSignature
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter((sig): sig is string => Boolean(sig))
    .some((sig) => {
      const sigBuf = Buffer.from(sig);
      return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
    });
}
