import type { ReactNode } from "react";
import Link from "next/link";

// answerText is the plain-text rendering of `answer` — needed because
// `answer` can be JSX (inline links), but the FAQPage JSON-LD schema below
// needs a plain string per question so AI answer engines and Google can
// lift each Q&A pair directly instead of having to parse markup.
export type Faq = { id: string; question: string; answer: ReactNode; answerText: string };

export function FaqList({
  title,
  description,
  faqs,
}: {
  title: string;
  description: string;
  faqs: Faq[];
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answerText },
    })),
  };

  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <div>
          <h1 className="text-[28px] font-bold text-text-primary">{title}</h1>
          <p className="mt-2 text-[15px] text-text-secondary">{description}</p>
        </div>

        <nav aria-label="Questions" className="flex flex-col gap-2 rounded-xl border border-border-subtle p-5">
          <p className="mb-1 text-[16px] font-bold text-text-primary">Jump to a question</p>
          <ol className="flex flex-col gap-1.5">
            {faqs.map((faq, i) => (
              <li key={faq.id} className="text-[14px]">
                <a href={`#${faq.id}`} className="text-accent-primary hover:text-text-primary">
                  {i + 1}. {faq.question}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex flex-col gap-6">
          {faqs.map((faq) => (
            <div key={faq.id} id={faq.id} className="scroll-mt-20 flex flex-col gap-2">
              <h2 className="text-[16px] font-semibold text-text-primary">{faq.question}</h2>
              <p className="text-[15px] text-text-secondary">{faq.answer}</p>
            </div>
          ))}
        </div>

        <p className="text-[16px] font-bold text-text-primary">
          Still have questions?{" "}
          <Link href="/contact" className="text-accent-primary underline">
            Contact us
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
