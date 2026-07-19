import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — ProSoc",
};

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Information we collect",
    body: "When you register a Society or Vendor on ProSoc, we collect information such as your name, email address, phone number, address, and — for Vendors — business details, service categories, and service areas. We also collect information generated through your use of the platform, including requirements, quotations, approvals, and messages exchanged through the system.",
  },
  {
    title: "2. How we use your information",
    body: "We use your information to operate the ProSoc platform: matching requirements with eligible vendors, facilitating quotations and approvals, sending transactional notifications by email, verifying phone numbers via SMS one-time codes, and maintaining a permanent, auditable record of procurement activity on the platform.",
  },
  {
    title: "3. Sharing of information",
    body: "Information relevant to a specific requirement — such as a Society's requirement details or a Vendor's quotation — is shared with the counterparties involved in that transaction (e.g. matched vendors, or the Society's Manager and Office Bearers) as necessary for the platform to function. We do not sell your personal information to third parties.",
  },
  {
    title: "4. Data retention",
    body: "Records of requirements, quotations, approvals, and Work Orders are retained permanently as part of each Society's and Vendor's procurement history on the platform. Account information is retained for as long as your account remains active, or as required by applicable law.",
  },
  {
    title: "5. Security",
    body: "We take reasonable technical and organizational measures to protect your information from unauthorized access, alteration, or disclosure. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.",
  },
  {
    title: "6. Your choices",
    body: "You may request access to, correction of, or deletion of your personal information, subject to our need to retain transaction records for legal, audit, and platform-integrity purposes. Contact us using the details on our Contact Us page to make a request.",
  },
  {
    title: "7. Changes to this policy",
    body: "We may update this Privacy Policy from time to time. Material changes will be reflected by an updated revision date on this page.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-6 py-16">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-[28px] font-bold text-text-primary">Privacy Policy</h1>
          
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
