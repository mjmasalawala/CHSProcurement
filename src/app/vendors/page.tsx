import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "For Vendors — Wisesoc",
  description:
    "Get matched automatically to cooperative housing society requirements in your category and city. Wisesoc is a reliable partner for fair, transparent procurement — for societies and vendors alike.",
};

const WHY_MISSING_OUT = [
  "You're invisible to most societies.",
  "You have no visibility into work at societies around you.",
  "You are tired of pouring money into marketing.",
];

const HOW_IT_WORKS = [
  { title: "Register once", body: "List your service categories and service areas." },
  { title: "Get matched", body: "No cold calling. You're invited the moment a society raises a requirement in your category and city." },
  { title: "Submit quotes", body: "Line-item based quotes, no haggling over WhatsApp." },
  { title: "Compete fairly", body: "Societies on Wisesoc compare quality, price and terms, not just who they already know." },
  { title: "Build track record", body: "Every job, every quote, every Work Order becomes part of your history and footprint on Wisesoc." },
];

export default function VendorsLandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-20 px-6 py-12">
      <section className="flex flex-col items-center gap-6 pt-12 text-center">
        <h1 className="max-w-2xl text-[24px] font-bold text-text-primary sm:text-[32px]">
          1.2 lakh cooperative housing societies are looking for vendors like you.
        </h1>
        <h1 className="max-w-2xl text-[24px] font-bold text-status-error sm:text-[32px]">
          Most will never find you.
        </h1>
        <p className="max-w-xl text-[18px] text-text-secondary">
          These societies raise materials, services and CapEx work every year — plumbing, painting,
          waterproofing, CCTV, Solar, Fire Safety, Electrical, AMC renewals — and most of it still gets awarded through
          word-of-mouth. </p>
        
        <h2 className="max-w-2xl text-[20px] font-bold text-status-success sm:text-[24px]">Wisesoc puts you in front of societies looking for your products and services.</h2>
        
        {/* <Link href="/register/vendor">
          <Button>Register Your Business</Button>
        </Link> */}
      </section>

      {/* <section className="flex w-full max-w-5xl flex-col gap-6">
        <div className="flex justify-center">
          {STATS.map((stat) => (
            <Card key={stat.label} className="flex max-w-sm flex-col items-center gap-1 text-center">
              <p className="text-[28px] font-bold tracking-tight text-accent-primary">{stat.value}</p>
              <p className="text-[13px] font-medium text-text-primary">{stat.label}</p>
              <p className="text-[12px] text-text-tertiary">{stat.note}</p>
            </Card>
          ))}
        </div>
      </section> */}

      <section className="flex w-full max-w-4xl flex-col gap-6">
        <h1 className="text-center text-[24px] font-bold text-text-primary sm:text-[32px]">
          Here is why you are missing out
        </h1>
        <ul className="mx-auto flex w-fit flex-col gap-3">
          {WHY_MISSING_OUT.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0 text-status-success" aria-hidden>
                <circle cx="10" cy="10" r="9" fill="currentColor" fillOpacity="0.15" />
                <path
                  d="M6 10.5L8.5 13L14 7.5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-[15px] font-medium text-text-primary">{item}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex w-full max-w-4xl flex-col gap-6">
        <h1 className="text-center text-[24px] font-semibold text-text-primary">How Wisesoc helps</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          {HOW_IT_WORKS.map((step, i) => (
            <Card key={step.title} className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-accent-primary">Step {i + 1}</span>
              <p className="text-[15px] font-medium text-text-primary">{step.title}</p>
              <p className="text-[13px] text-text-secondary">{step.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-row items-center gap-4">
        <Link href="/register/vendor">
          <Button>Register Your Business</Button>
        </Link>
        <Link href="/faq/vendors">
          <Button>Frequently Asked Questions</Button>
        </Link>
      </section>
    </main>
  );
}
