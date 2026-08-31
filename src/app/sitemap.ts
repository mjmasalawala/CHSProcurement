import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/base-url";

// Every public, unauthenticated page — the FAQ pages are the ones GEO cares
// about most (structured Q&A an AI answer engine can lift directly), but the
// full public surface is listed so nothing relevant is left undiscovered.
const PUBLIC_ROUTES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/about", priority: 0.8 },
  { path: "/faq", priority: 0.9 },
  { path: "/faq/vendors", priority: 0.9 },
  { path: "/vendors", priority: 0.8 },
  { path: "/contact", priority: 0.5 },
  { path: "/register/society", priority: 0.7 },
  { path: "/register/vendor", priority: 0.7 },
  { path: "/privacy", priority: 0.2 },
  { path: "/terms", priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getBaseUrl();
  const lastModified = new Date();

  return PUBLIC_ROUTES.map(({ path, priority }) => ({
    url: `${base}${path}`,
    lastModified,
    priority,
  }));
}
