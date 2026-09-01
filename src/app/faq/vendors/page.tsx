import type { Metadata } from "next";
import Link from "next/link";
import { FaqList, type Faq } from "@/components/faq-list";

export const metadata: Metadata = {
  title: "FAQ for Vendors — Wisesoc",
  description:
    "How vendors register on Wisesoc, get matched to cooperative housing society requirements, and submit quotes — the platform's fair, transparent procurement process explained.",
};

const FAQS: Faq[] = [
  {
    id: "what-is-wisesoc",
    question: "What is Wisesoc?",
    answer:
      "Wisesoc is a reliable partner for fair, transparent procurement that connects cooperative housing societies with vendors for repair, maintenance, and capital expenditure work. Societies raise requirements, Wisesoc matches them with vendors in the right category and city, and vendors submit structured quotes to compete for the work.",
    answerText:
      "Wisesoc is a reliable partner for fair, transparent procurement that connects cooperative housing societies with vendors for repair, maintenance, and capital expenditure work. Societies raise requirements, Wisesoc matches them with vendors in the right category and city, and vendors submit structured quotes to compete for the work.",
  },
  {
    id: "how-to-register",
    question: "How do I register on the portal?",
    answer: (
      <>
        Head to the{" "}
        <Link href="/register/vendor" className="text-accent-primary underline">
          vendor registration page
        </Link>{" "}
        and fill in your business details, service categories, and the cities you operate in. Once your
        registration is reviewed and approved, you&apos;ll get an email with a link to set a password and log
        in.
      </>
    ),
    answerText:
      "Head to the vendor registration page (/register/vendor) and fill in your business details, service categories, and the cities you operate in. Once your registration is reviewed and approved, you'll get an email with a link to set a password and log in.",
  },
  {
    id: "how-matching-works",
    question: "How does vendor matching work?",
    answer:
      "You're matched automatically. When a cooperative housing society raises a requirement in a category and city you've registered for, Wisesoc invites you to quote — you don't need to search for work or ask anyone to add you. Adding more categories or cities to your profile widens the requirements you get matched to going forward.",
    answerText:
      "You're matched automatically. When a cooperative housing society raises a requirement in a category and city you've registered for, Wisesoc invites you to quote — you don't need to search for work or ask anyone to add you. Adding more categories or cities to your profile widens the requirements you get matched to going forward.",
  },
  {
    id: "how-many-orders",
    question: "How many orders can I expect?",
    answer:
      "That depends on your categories, the cities you serve, and how competitive your quotes are — Wisesoc doesn't guarantee a fixed volume of work. What we do guarantee is visibility: you're automatically invited to every matching requirement raised on the platform in your categories and cities, instead of relying on word-of-mouth.",
    answerText:
      "That depends on your categories, the cities you serve, and how competitive your quotes are — Wisesoc doesn't guarantee a fixed volume of work. What we do guarantee is visibility: you're automatically invited to every matching requirement raised on the platform in your categories and cities, instead of relying on word-of-mouth.",
  },
  {
    id: "how-to-quote",
    question: "How do I submit a quote once I'm invited?",
    answer:
      "You'll get a notification when you're matched to a requirement. From your vendor dashboard, open the requirement and submit a structured, line-item quote along with your payment terms, warranty, and completion timeline before the quote deadline. You won't be able to see what other vendors have quoted, and they won't see yours.",
    answerText:
      "You'll get a notification when you're matched to a requirement. From your vendor dashboard, open the requirement and submit a structured, line-item quote along with your payment terms, warranty, and completion timeline before the quote deadline. You won't be able to see what other vendors have quoted, and they won't see yours.",
  },
  {
    id: "how-selected",
    question: "How does a society decide which vendor to select?",
    answer:
      "The society's Manager reviews all quotes submitted before the deadline and recommends one, considering price, line items, and terms. Depending on the value of the work, that recommendation may also need approval from the society's Office Bearers before a Work Order is issued.",
    answerText:
      "The society's Manager reviews all quotes submitted before the deadline and recommends one, considering price, line items, and terms. Depending on the value of the work, that recommendation may also need approval from the society's Office Bearers before a Work Order is issued.",
  },
  {
    id: "cost",
    question: "How much does Wisesoc cost?",
    answer:
      "Wisesoc is currently free for vendors to register and use. Currently, there's no subscription fee and no commission on the work you get through our platform.",
    answerText:
      "Wisesoc is currently free for vendors to register and use. Currently, there's no subscription fee and no commission on the work you get through our platform.",
  },
  {
    id: "categories-cities",
    question: "Can I update my categories or service areas later?",
    answer:
      "Yes — you can edit your service categories and cities any time from your vendor profile. Adding a new category or city automatically makes you eligible for matching against any open requirements in that category or city.",
    answerText:
      "Yes — you can edit your service categories and cities any time from your vendor profile. Adding a new category or city automatically makes you eligible for matching against any open requirements in that category or city.",
  },
  {
    id: "phone-verification",
    question: "Why do I need to verify my phone number?",
    answer:
      "Phone verification confirms you're a real, reachable business, which builds trust with the societies reviewing your quotes. It's a one-time step done via a WhatsApp OTP during registration or onboarding.",
    answerText:
      "Phone verification confirms you're a real, reachable business, which builds trust with the societies reviewing your quotes. It's a one-time step done via a WhatsApp OTP during registration or onboarding.",
  },
  {
    id: "track-record",
    question: "Does Wisesoc keep a record of my past work?",
    answer:
      "Yes — every quote you submit and every Work Order you're awarded stays on your Wisesoc history. Over time this becomes a track record that helps societies trust your bids. Your data is safe with Wisesoc, we do not disclose your quotes or pricing to any other society or business.",
    answerText:
      "Yes — every quote you submit and every Work Order you're awarded stays on your Wisesoc history. Over time this becomes a track record that helps societies trust your bids. Your data is safe with Wisesoc, we do not disclose your quotes or pricing to any other society or business.",
  },
  {
    id: "existing-society",
    question: "A society I already work with wants me on Wisesoc — what do I do?",
    answer: (
      <>
        Ask them to invite you using the &quot;Ask a Vendor to Register&quot; option in their society
        portal, or simply{" "}
        <Link href="/register/vendor" className="text-accent-primary underline">
          register yourself
        </Link>{" "}
        with the same categories and city they need — either way, you&apos;ll be matched to their
        requirement automatically once you&apos;re approved.
      </>
    ),
    answerText:
      "Ask them to invite you using the \"Ask a Vendor to Register\" option in their society portal, or simply register yourself (/register/vendor) with the same categories and city they need — either way, you'll be matched to their requirement automatically once you're approved.",
  },
  {
    id: "support",
    question: "Who do I contact if I have an issue?",
    answer: (
      <>
        Reach out any time through the{" "}
        <Link href="/contact" className="text-accent-primary underline">
          Contact Us page
        </Link>{" "}
        and we&apos;ll get back to you.
      </>
    ),
    answerText: "Reach out any time through the Contact Us page (/contact) and we'll get back to you.",
  },
];

export default function VendorFaqPage() {
  return (
    <FaqList
      title="Frequently Asked Questions"
      description="Answers for vendors registering or working on Wisesoc."
      faqs={FAQS}
    />
  );
}
