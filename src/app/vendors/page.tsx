import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "For Vendors — Wisesoc",
  description:
    "Get matched automatically to cooperative housing society requirements in your category and city. Wisesoc is a reliable partner for fair, transparent procurement — for societies and vendors alike.",
};

const WHY_MISSING_OUT = [
  "Societies don't know you can fulfill their requirements.",
  "You have no visibility into the requirements of societies around you.",
  "Lead generation marketing just doesn't work for this segment of clients.",
];

const HOW_IT_WORKS = [
  { title: "Register once", body: "List your service categories and service areas." },
  {
    title: "Get Matched with No Marketing Cost",
    body: "No cold calling leads. When there is a genuine requirement, you get notified.",
  },
  {
    title: "Submit quotes",
    body: "Contact the society, understand the requirement and submit your quote.",
  },
  {
    title: "Compete fairly",
    body: "Wisesoc helps societies compare quality and terms along with prices, so you can compete fairly and transparently.",
  },
];

export default function VendorsLandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-20 px-6 py-12">
      <section className="flex flex-col items-center gap-6 pt-12 text-center">
        <h1 className="max-w-2xl text-[24px] font-bold text-text-primary sm:text-[32px]">
          1.2 lakh cooperative housing societies are looking for vendors like you.
        </h1>
        <h1 className="max-w-2xl text-[24px] font-bold text-accent-primary sm:text-[32px]">
          Most will never find you.
        </h1>
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
              <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0 text-status-error" aria-hidden>
                <circle cx="10" cy="10" r="9" fill="currentColor" fillOpacity="0.15" />
                <path
                  d="M7 7L13 13M13 7L7 13"
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
        <h1 className="text-center text-[24px] font-bold text-text-primary sm:text-[32px]">How Wisesoc helps</h1>
        <div className="mx-auto flex w-full max-w-md flex-col">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.title} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-primary text-[18px] font-bold text-white shadow-sm">
                  {i + 1}
                </div>
                {i < HOW_IT_WORKS.length - 1 && <div className="w-0.5 flex-1 bg-border-subtle" />}
              </div>
              <div className="flex flex-col gap-1 pt-1.5 pb-8">
                <p className="text-[15px] font-semibold text-text-primary">{step.title}</p>
                <p className="text-[13px] text-text-secondary">{step.body}</p>
              </div>
            </div>
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
