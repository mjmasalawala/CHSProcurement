import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — ProSoc",
};

export default function AboutPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-6 py-16">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <h1 className="text-[28px] font-bold text-text-primary">About ProSoc</h1>

        <p className="text-[15px] text-text-secondary">
          ProSoc is a single-URL platform that solves the &quot;three-quotation&quot; problem for
          housing society repairs, maintenance, and capital expenditure work. Instead of
          Managers and Office Bearers chasing quotes informally over phone calls and
          WhatsApp, ProSoc matches every requirement with eligible, verified vendors in the
          right category and city — automatically.
        </p>

        <p className="text-[15px] text-text-secondary">
          Vendors submit structured, line-item quotations without seeing what competitors have
          bid, so selection is decided on quality and price rather than who a society already
          knows. Every requirement, quote, and approval is recorded permanently, giving
          societies a transparent, searchable history of their procurement decisions.
        </p>

        <h2 className="mt-4 text-[18px] font-semibold text-text-primary">What we&apos;re building</h2>
        <p className="text-[15px] text-text-secondary">
          Thousands of housing societies across India need this kind of recurring work —
          waterproofing, painting, plumbing, electrical, AMC renewals, and more — but have no
          shared channel to find reliable vendors, and no structured way to compare bids
          fairly. ProSoc gives societies a matched vendor pool and a co-approval workflow, and
          gives vendors visibility into work they&apos;d otherwise never hear about.
        </p>
      </div>
    </main>
  );
}
