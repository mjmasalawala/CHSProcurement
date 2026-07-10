import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const HOW_IT_WORKS = [
  { title: "Raise a requirement", body: "A Manager describes the work — category, description, deadline." },
  { title: "System matches vendors", body: "Eligible Active vendors in the right category and city are invited automatically." },
  { title: "Vendors bid blind", body: "Structured quotations, submitted without seeing competitors' bids." },
  { title: "Office Bearers approve", body: "The Manager recommends; Chairman, Secretary and Treasurer co-approve." },
  { title: "Fully archived", body: "Every requirement, every bid, every approval — searchable, permanently." },
];

export default function Home() {
  return (
    <>
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-[18px] font-semibold text-text-primary">ProSoc</span>
        <Link href="/login">
          <Button variant="ghost">Login</Button>
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center gap-20 px-6 pb-24">
        <section className="flex flex-col items-center gap-6 pt-12 text-center">
          <h1 className="max-w-2xl text-[24px] font-bold text-text-primary sm:text-[32px]">
            Fair, transparent, system-matched quotations for your housing society
          </h1>
          <p className="max-w-xl text-[15px] text-text-secondary">
            ProSoc replaces the informal &quot;get three quotes&quot; process with a matched vendor
            pool, blind bidding, and a co-approval workflow — with a full, searchable record of
            every transaction.
          </p>
          <Link href="/register/society">
            <Button>Register your Society</Button>
          </Link>
        </section>

        <section className="flex w-full max-w-4xl flex-col gap-6">
          <h2 className="text-center text-[18px] font-semibold text-text-primary">How it works</h2>
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

        <section className="flex flex-col items-center gap-4">
          <Link href="/register/society">
            <Button>Register your Society</Button>
          </Link>
        </section>
      </main>

      <footer className="flex items-center justify-center px-6 py-8 text-[13px] text-text-secondary">
        <Link href="/register/vendor" className="underline hover:text-text-primary">
          Register as a Vendor
        </Link>
      </footer>
    </>
  );
}
