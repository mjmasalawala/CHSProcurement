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
