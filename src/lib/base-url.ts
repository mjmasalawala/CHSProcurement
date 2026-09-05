// Base URL for links embedded in emails/notifications. NEXTAUTH_URL is the
// explicit source of truth when set, but nothing here should silently
// degrade to localhost in production just because that variable is missing
// (as happened once already).
//
// VERCEL_PROJECT_PRODUCTION_URL is Vercel's record of the project's
// assigned *production* domain — it's the same value on every deployment
// regardless of which one is actually running, so it must only be used
// when this deployment genuinely is production (VERCEL_ENV === "production").
// Using it unconditionally (2026-09-05 bug, confirmed: a staging-generated
// invite link pointed at production's domain while the token only existed
// in staging's database, so clicking it always showed "invalid or
// expired" no matter how fresh the invite was) sends every staging/preview
// link to the wrong environment's database entirely — a worse failure
// than localhost would have been, since it looks like a real, working link
// right up until someone clicks it. VERCEL_URL is Vercel's per-deployment
// URL, present on every deployment (preview and production alike), so it's
// the correct fallback for anything that isn't production.
export function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
