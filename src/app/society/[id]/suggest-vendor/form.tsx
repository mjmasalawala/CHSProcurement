"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { suggestVendor } from "./actions";

export function SuggestVendorForm({ societyId }: { societyId: string }) {
  const [vendorName, setVendorName] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    const result = await suggestVendor(societyId, { vendorName, vendorPhone, vendorEmail });
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    setVendorName("");
    setVendorPhone("");
    setVendorEmail("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="vendorName">Vendor name</Label>
          <Input
            id="vendorName"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="vendorPhone">Phone (if known)</Label>
          <Input
            id="vendorPhone"
            type="tel"
            value={vendorPhone}
            onChange={(e) => setVendorPhone(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="vendorEmail">Email</Label>
          <Input
            id="vendorEmail"
            type="email"
            value={vendorEmail}
            onChange={(e) => setVendorEmail(e.target.value)}
            required
          />
        </div>
      </div>

      {error && <p className="text-[13px] text-status-error">{error}</p>}
      {success && (
        <p className="text-[13px] text-status-success">Invite sent — we&apos;ll let you know once they register.</p>
      )}

      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? "Sending…" : "Ask Vendor to Register"}
      </Button>
    </form>
  );
}
