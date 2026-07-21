import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const WHY_MISSING_OUT = [
  {
    title: "You're invisible to most societies",
    body: "The informal \"get three quotes\" process runs on word-of-mouth. If you're not already known to a Secretary or Chairman, you never get the call — no matter how good your work is.",
  },
  {
    title: "No visibility into upcoming work",
    body: "Waterproofing, painting, plumbing, electrical, AMC renewals — tens of thousands of buildings need this work on a recurring cycle, but there's no shared channel to find out when a specific society needs it.",
  },
  {
    title: "Unfair, opaque selection",
    body: "Without structured quotes, good work often loses to whoever's cheapest or best-connected — reputation, quality, and reliability rarely factor in.",
  },
];

const HOW_IT_WORKS = [
  { title: "Register once", body: "List your service categories and service areas." },
  { title: "Get matched", body: "No cold calling. You're invited the moment a society raises a requirement in your category and city." },
  { title: "Submit quotes", body: "Line-item based quotes, no haggling over WhatsApp." },
  { title: "Compete fairly", body: "Societies on ProSoc compare quality, price and terms, not just who they already know." },
  { title: "Build track record", body: "Every job, every quote, every Work Order becomes part of your history and footprint on ProSoc." },
];

export default function VendorsLandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-20 px-6 py-12">
      <section className="flex flex-col items-center gap-6 pt-12 text-center">
        <h1 className="max-w-2xl text-[24px] font-bold text-text-primary sm:text-[32px]">
          1.2 lakh housing societies are looking for vendors like you. 
        </h1>
        <h1 className="max-w-2xl text-[24px] font-bold text-status-error sm:text-[32px]">
          Most will never find you.
        </h1>
        <p className="max-w-xl text-[18px] text-text-secondary">
          These societies raise materials, services and CapEx work every year — plumbing, painting,
          waterproofing, CCTV, Solar, Fire Safety, Electrical, AMC renewals — and most of it still gets awarded through
          word-of-mouth. </p>
        
        <h2 className="max-w-2xl text-[20px] font-bold text-status-success sm:text-[24px]">ProSoc puts your business in front of societies actively looking for exactly
        what you sell.</h2>
        
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
        <h2 className="text-center text-[24px] font-semibold text-text-primary">
          Why good vendors are missing out
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {WHY_MISSING_OUT.map((item) => (
            <Card key={item.title} className="flex flex-col gap-2">
              <p className="text-[15px] font-medium text-text-primary">{item.title}</p>
              <p className="text-[13px] text-text-secondary">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex w-full max-w-4xl flex-col gap-6">
        <h2 className="text-center text-[24px] font-semibold text-text-primary">How ProSoc helps</h2>
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
