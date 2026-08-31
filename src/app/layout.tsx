import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getBaseUrl } from "@/lib/base-url";
import "./globals.css";

const SITE_DESCRIPTION =
  "Wisesoc is a reliable partner for cooperative housing societies, helping them run fair, transparent vendor procurement for repair, maintenance, and capital expenditure work — matched vendors, blind quoting, and committee co-approval, with a permanent record of every decision.";

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: "Wisesoc — Fair, Transparent Procurement for Cooperative Housing Societies",
    template: "%s",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "cooperative housing society",
    "housing society procurement",
    "society vendor management",
    "RWA vendor management",
    "housing society repair and maintenance",
    "transparent vendor quotations",
  ],
  openGraph: {
    title: "Wisesoc — Fair, Transparent Procurement for Cooperative Housing Societies",
    description: SITE_DESCRIPTION,
    siteName: "Wisesoc",
    type: "website",
  },
};

// Organization/WebSite structured data, present on every page — helps
// search and AI answer engines resolve "Wisesoc" as a specific entity (a
// cooperative-housing-society procurement platform) rather than guessing
// from page copy alone.
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Wisesoc",
  description: SITE_DESCRIPTION,
  slogan: "Fair, transparent procurement for cooperative housing societies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
        <Header />
        <div className="flex flex-1 flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
