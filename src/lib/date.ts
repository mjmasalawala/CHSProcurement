const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Every date shown to a user (society/vendor UI, emails, PDFs) uses this
// DD-MMM-YYYY format — unambiguous across locales, unlike DD/MM vs MM/DD.
// Does not apply to <input type="date"> values, which must stay ISO
// YYYY-MM-DD (the native input format).
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = d.getDate().toString().padStart(2, "0");
  return `${day}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  return `${formatDate(d)}, ${time}`;
}

// WhatsApp deadline placeholder format ("DD-MMM-YY HH:MM", 24h clock) for
// wisesoc_requirement_matched_v1 — a distinct spec from formatDate/
// formatDateTime (4-digit year, 12h clock) because the template's
// placeholder format was fixed independently when the template was
// approved; changing it would mean resubmitting the template.
export function formatWhatsappDeadline(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = d.getDate().toString().padStart(2, "0");
  const year = (d.getFullYear() % 100).toString().padStart(2, "0");
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${day}-${MONTHS[d.getMonth()]}-${year} ${hours}:${minutes}`;
}

// Coarse elapsed/remaining-time phrasing (e.g. "2 days", "18 hours") — for
// contexts like "given X to quote", where a precise duration is noise.
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / (60 * 1000));
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}
