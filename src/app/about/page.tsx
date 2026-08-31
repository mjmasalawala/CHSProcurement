import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Wisesoc",
  description:
    "Wisesoc is a reliable partner for cooperative housing societies, matching every repair, maintenance, and capital expenditure requirement with verified vendors for fair, transparent procurement.",
};

export default function AboutPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-6 py-16">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <h1 className="text-[28px] font-bold text-text-primary">About Wisesoc</h1>

        <p className="text-[15px] text-text-secondary">
          Wisesoc is a reliable partner for cooperative housing societies, built to solve the
          &quot;three-quotation&quot; problem for repairs, maintenance, and capital expenditure work.
          Instead of Managers and Office Bearers chasing quotes informally over phone calls and
          WhatsApp, Wisesoc matches every requirement with eligible, verified vendors in the
          right category and city — automatically.
        </p>

        <p className="text-[15px] text-text-secondary">
          Vendors submit structured, line-item quotations without seeing what competitors have
          bid, so selection is decided on quality and price rather than who a society already
          knows. Every requirement, quote, and approval is recorded permanently, giving
          cooperative housing societies a transparent, searchable history of their procurement
          decisions — the fair and transparent procurement practice every committee wants to point
          to.
        </p>

        <h2 className="mt-4 text-[18px] font-semibold text-text-primary">What we&apos;re building</h2>
        <p className="text-[15px] text-text-secondary">
          Thousands of cooperative housing societies across India need this kind of recurring work —
          waterproofing, painting, plumbing, electrical, AMC renewals, and more — but have no
          shared channel to find reliable vendors, and no structured way to compare bids
          fairly. Wisesoc gives societies a matched vendor pool and a co-approval workflow, and
          gives vendors visibility into work they&apos;d otherwise never hear about.
        </p>
      </div>
    </main>
  );
}
