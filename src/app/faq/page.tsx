import type { Metadata } from "next";
import Link from "next/link";
import { FaqList, type Faq } from "@/components/faq-list";

export const metadata: Metadata = {
  title: "FAQ — ProSoc",
};

// Society/Manager-facing FAQ — first up since it's what the registration and
// invite-onboarding emails link to (register/society/actions.ts,
// admin/societies/[id]/actions.ts). Vendor-facing FAQ lives at /faq/vendors.
// answer is ReactNode (not just string) so an answer can hyperlink to the
// page it's referring to instead of naming it as plain text.
const FAQS: Faq[] = [
  {
    id: "what-is-prosoc",
    question: "What is ProSoc?",
    answer:
      "ProSoc is a platform that helps housing societies raise repair, maintenance, and capital expenditure requirements, get quotes from vendors, and approve the best one — all in one place, with a permanent record of the whole process.",
  },
  {
    id: "why-use-it",
    question: "Why should our society use ProSoc?",
    answer:
      "Most societies collect quotes informally over phone calls and WhatsApp, which makes it hard to compare bids fairly and easy for decisions to be second-guessed later. ProSoc matches your requirement with eligible vendors automatically, collects structured line-item quotes so vendors can't see each other's bids, and keeps a searchable history of every requirement, quote, and approval — so your committee always has a transparent record to point to.",
  },
  {
    id: "how-it-works",
    question: "How does ProSoc work, step by step?",
    answer:
      "A Manager or Office Bearer raises a requirement (what needs doing, category, city, and a quote deadline). ProSoc automatically invites vendors who match that category and city. Vendors submit structured quotes before the deadline. The Manager reviews the quotes and recommends one; two Office Bearers then need to approve it (or the Manager can finalize directly if it's below the society's approval threshold). Once approved, a Work Order is generated automatically.",
  },
  {
    id: "who-can-register",
    question: "Who can register our society — does it have to be the Secretary?",
    answer: (
      <>
        No. Any Manager, Office Bearer (Chairman, Secretary, or Treasurer), or General Body Member can{" "}
        <Link href="/register/society" className="text-accent-primary underline">
          submit the registration
        </Link>
        . If a General Body Member registers, they&apos;ll be asked to name a Manager or Office Bearer to
        actually manage the account, since a General Body Member doesn&apos;t get platform access
        themselves. We always keep the Secretary&apos;s contact details on file too, even if they&apos;re
        not the one setting things up.
      </>
    ),
  },
  {
    id: "after-registration",
    question: "What happens after we submit our registration?",
    answer:
      "ProSoc verifies the details and approves the society, usually within a couple of working days. Once approved, whoever was named to manage the account gets an email with a link to create a password. From there, they can invite the rest of the committee — Manager, Chairman, Secretary, and Treasurer — from the Members page.",
  },
  {
    id: "roles",
    question: "What's the role of the Manager and Office Bearers?",
    answer:
      "The Manager typically raises requirements and reviews incoming quotes day-to-day. The three Office Bearers — Chairman, Secretary, and Treasurer — each get a vote on approving a quotation above the society's approval threshold (two of three approvals are needed), and can also invite other committee members, propose or approve removing a member, and propose changes to the approval threshold.",
  },
  {
    id: "vendor-selection",
    question: "How are vendors matched and selected?",
    answer:
      "ProSoc automatically invites every vendor whose service category and city match your requirement — you don't have to search for or add them yourself. Vendors submit quotes without seeing what anyone else has bid, so the comparison your Manager sees is based purely on price, line items, and terms.",
  },
  {
    id: "existing-vendor",
    question: "What if I want an existing vendor's quote on the platform?",
    answer: (
      <>
        Use the{" "}
        <Link href="/app" className="text-accent-primary underline">
          &quot;Ask a Vendor to Register&quot;
        </Link>{" "}
        page (in your society portal) to invite them onto ProSoc. Once they register, they&apos;ll be sent
        your requirement and can submit a quote for it alongside every other matched vendor.
        <br />
        <br />
        Note: you&apos;ll need to be logged in to your society account to do this.
      </>
    ),
  },
  {
    id: "transparency",
    question: "Is the process transparent for our committee?",
    answer:
      "Yes — every requirement, quote, approval vote, and Work Order is recorded and stays visible in your society's archive. Nothing is decided outside the platform, so any committee member can review how and why a vendor was selected, at any time.",
  },
  {
    id: "cost",
    question: "How much does ProSoc cost?",
    answer:
      "ProSoc is a free platform for societies to register and use. Our goal is to help create transparency, visibility and fairness in the society procurement process.",
  },
  {
    id: "support",
    question: "Who do we contact if we have a question or run into an issue?",
    answer: (
      <>
        Reach out any time through the{" "}
        <Link href="/contact" className="text-accent-primary underline">
          Contact Us page
        </Link>{" "}
        and we&apos;ll get back to you.
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <FaqList
      title="Frequently Asked Questions"
      description="Answers for societies and society committee members getting started on ProSoc."
      faqs={FAQS}
    />
  );
}
