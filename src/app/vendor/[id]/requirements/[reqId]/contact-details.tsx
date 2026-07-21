"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { revealRequirementContact } from "./actions";

export function ContactDetails({
  vendorCompanyId,
  requirementId,
  revealed,
  address,
  registrantName,
  registrantPhone,
  registrantEmail,
}: {
  vendorCompanyId: string;
  requirementId: string;
  revealed: boolean;
  address: string;
  registrantName: string;
  registrantPhone: string;
  registrantEmail: string;
}) {
  const router = useRouter();
  const [isRevealed, setIsRevealed] = useState(revealed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReveal() {
    setLoading(true);
    setError(null);
    try {
      const result = await revealRequirementContact(vendorCompanyId, requirementId);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        setIsRevealed(true);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!isRevealed) {
    return (
      <Card className="flex flex-col items-start gap-2">
        <p className="text-[13px] font-medium text-text-primary">Contact details</p>
        <p className="text-[13px] text-text-secondary">
          The society&apos;s address and contact person are hidden until you reveal them — useful if you
          need to arrange a site visit before quoting.
        </p>
        {error && <p className="text-[13px] text-status-error">{error}</p>}
        <Button onClick={handleReveal} disabled={loading}>
          {loading ? "Revealing…" : "Show Contact Details"}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-2">
      <p className="text-[13px] font-medium text-text-primary">Contact details</p>
      <p className="text-[13px] text-text-secondary">Location: {address}</p>
      <p className="text-[13px] text-text-secondary">Contact: {registrantName}</p>
      <p className="text-[13px] text-text-secondary">Phone: {registrantPhone}</p>
      <p className="text-[13px] text-text-secondary">Email: {registrantEmail}</p>
    </Card>
  );
}
