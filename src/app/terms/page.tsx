import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions — ProSoc",
};

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Acceptance of terms",
    body: "By registering for or using ProSoc, you agree to be bound by these Terms and Conditions. If you do not agree, you may not use the platform.",
  },
  {
    title: "2. Eligibility and accounts",
    body: "ProSoc is available to housing societies and vendors operating in India. You are responsible for the accuracy of the information you submit during registration and for maintaining the confidentiality of your account credentials.",
  },
  {
    title: "3. Role of ProSoc",
    body: "ProSoc provides a platform that matches Societies with eligible Vendors and facilitates structured quotations and approvals. ProSoc is not a party to any contract formed between a Society and a Vendor, and does not guarantee the quality, timeliness, or outcome of any work performed.",
  },
  {
    title: "4. Vendor conduct",
    body: "Vendors agree to submit accurate quotations and to perform any work awarded to them in accordance with applicable law and professional standards. ProSoc may suspend or remove a Vendor from the platform for misconduct, misrepresentation, or repeated complaints.",
  },
  {
    title: "5. Society conduct",
    body: "Societies agree to use the platform's approval workflow in good faith and to honor Work Orders issued through ProSoc. Societies are responsible for the decisions made by their Managers and Office Bearers on the platform.",
  },
  {
    title: "6. Fees",
    body: "Any fees applicable to using ProSoc will be communicated separately and are subject to change with notice.",
  },
  {
    title: "7. Limitation of liability",
    body: "To the maximum extent permitted by law, ProSoc is not liable for any indirect, incidental, or consequential damages arising from your use of the platform, or from the acts or omissions of any Society or Vendor using the platform.",
  },
  {
    title: "8. Changes to these terms",
    body: "We may update these Terms and Conditions from time to time. Continued use of ProSoc after changes take effect constitutes acceptance of the revised terms.",
  },
];

export default function TermsPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-6 py-16">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-[28px] font-bold text-text-primary">Terms and Conditions</h1>
          {/* <p className="mt-2 text-[13px] text-text-secondary">
            Draft — last updated 14 Jul 2026. This is placeholder text and has not been reviewed by legal
            counsel; it should not be relied on until finalized.
          </p> */}
        </div>

        {SECTIONS.map((section) => (
          <div key={section.title} className="flex flex-col gap-2">
            <h2 className="text-[16px] font-semibold text-text-primary">{section.title}</h2>
            <p className="text-[15px] text-text-secondary">{section.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
