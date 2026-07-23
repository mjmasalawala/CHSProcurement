// Shared between the vendor dashboard's "Missed invites" stat and its
// drill-down (requirements?filter=missed) so the two always agree on what
// counts as "missed" and over what window.
export const MISSED_INVITE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
