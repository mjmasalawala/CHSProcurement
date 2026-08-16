// Base URL for links embedded in emails/notifications. NEXTAUTH_URL is the
// explicit source of truth when set, but nothing here should silently
// degrade to localhost in production just because that variable is missing
// (as happened once already) — VERCEL_PROJECT_PRODUCTION_URL is Vercel's own
// record of the project's assigned production domain (custom domain if one
// is attached, otherwise the *.vercel.app one), always present on Vercel
// deployments, so it's a reliable safety net before falling back to
// localhost for local dev.
export function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
