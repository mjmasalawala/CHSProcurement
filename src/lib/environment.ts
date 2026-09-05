// Single source of truth for "is this the staging deployment" — Vercel sets
// VERCEL_GIT_COMMIT_REF automatically on every deploy, no manual env var
// needed. "develop" is this project's staging branch (main is production).
// Used both for the header's staging banner (components/layout/header.tsx)
// and for gating real outbound sends away from staging (lib/messaging/
// dispatcher.ts) — if that branch mapping ever changes, this is the one
// place to update.
export function isStagingEnvironment(): boolean {
  return process.env.VERCEL_GIT_COMMIT_REF === "develop";
}
