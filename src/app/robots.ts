import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/base-url";
import { isStagingEnvironment } from "@/lib/environment";

// Explicitly allow AI crawlers/answer-engine bots (not just default-allow by
// omission) so GEO — showing up in ChatGPT/Perplexity/Claude/Gemini answers
// about cooperative housing society procurement — isn't left to chance.
// Everything under an authenticated workspace (society/vendor/admin
// dashboards, the generic /app entry point, and auth flows) is disallowed —
// there's nothing for a crawler to index there, and requirement/bid data
// living behind those routes is exactly what shouldn't turn up in search or
// AI-answer results.
const DISALLOWED_PATHS = [
  "/app",
  "/admin",
  "/society/",
  "/vendor/",
  "/login",
  "/forgot-password",
  "/reset-password/",
  "/invite/",
  "/api/",
];

const AI_CRAWLER_USER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "Amazonbot",
  "cohere-ai",
  "Meta-ExternalAgent",
  "DuckAssistBot",
];

export default function robots(): MetadataRoute.Robots {
  const base = getBaseUrl();

  // Staging is already access-gated by Vercel Deployment Protection (no
  // crawler — AI or otherwise — can get past its login wall to see any
  // content), but that's a project setting that could get toggled off by
  // accident; a blanket disallow here costs nothing and doesn't depend on
  // it staying on. Production keeps the permissive, GEO-oriented rules
  // below unchanged.
  if (isStagingEnvironment()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS },
      ...AI_CRAWLER_USER_AGENTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: DISALLOWED_PATHS,
      })),
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
