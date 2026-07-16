"use client";

import { useState } from "react";
import { WizardShell } from "@/components/ui/wizard-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { TagInput } from "@/components/ui/tag-input";
import { Button } from "@/components/ui/button";
import { registerVendor, type VendorRegistrationInput } from "./actions";

const BUSINESS_TYPES = [
  { value: "PROPRIETORSHIP", label: "Proprietorship" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "PRIVATE_LIMITED", label: "Private Limited" },
  { value: "LLP", label: "LLP" },
  { value: "OTHER", label: "Other" },
];

const TOTAL_STEPS = 6;

interface Props {
  categories: { id: string; name: string }[];
  cities: { id: string; name: string }[];
  // Prefills from a society's "Suggest a Vendor" invite link (?name=&email=&phone=)
  // — whatever the suggesting society already knew about this vendor.
  initial?: { name?: string; ownerEmail?: string; ownerPhone?: string };
}

export function VendorRegistrationWizard({ categories, cities, initial }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<VendorRegistrationInput>({
    name: initial?.name ?? "",
    businessType: "",
    ownerName: "",
    ownerEmail: initial?.ownerEmail ?? "",
    ownerPhone: initial?.ownerPhone ?? "",
    registeredAddress: "",
    password: "",
    categoryIds: [],
    requestedCategory: "",
    cityIds: [],
    societiesServiced: [],
    gstNumber: "",
    panNumber: "",
    yearsInBusiness: "",
    description: "",
  });

  function update<K extends keyof VendorRegistrationInput>(key: K, value: VendorRegistrationInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canProceed = {
    1: !!(form.name && form.businessType && form.ownerName),
    2: !!(form.ownerEmail && form.ownerPhone && form.registeredAddress && form.password.length >= 8),
    3: form.categoryIds.length > 0,
    4: form.cityIds.length > 0,
    5: true,
    6: true,
  }[step];

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await registerVendor(form);
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full">
      {step === 1 && (
        <WizardShell
          step={1}
          totalSteps={TOTAL_STEPS}
          title="Tell us about your business"
          onNext={() => setStep(2)}
          nextDisabled={!canProceed}
        >
          <div>
            <Label htmlFor="name">Company / Business Name</Label>
            <Input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="businessType">Business Type</Label>
            <Select
              id="businessType"
              value={form.businessType}
              onChange={(e) => update("businessType", e.target.value)}
            >
              <option value="">Select one</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ownerName">Owner Name</Label>
            <Input
              id="ownerName"
              autoComplete="name"
              value={form.ownerName}
              onChange={(e) => update("ownerName", e.target.value)}
            />
          </div>
        </WizardShell>
      )}

      {step === 2 && (
        <WizardShell
          step={2}
          totalSteps={TOTAL_STEPS}
          title="Contact &amp; login"
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          nextDisabled={!canProceed}
        >
          <div>
            <Label htmlFor="ownerEmail">Owner Email (used to log in)</Label>
            <Input
              id="ownerEmail"
              name="ownerEmail"
              type="email"
              autoComplete="username"
              value={form.ownerEmail}
              onChange={(e) => update("ownerEmail", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ownerPhone">Owner Phone</Label>
            <Input
              id="ownerPhone"
              name="ownerPhone"
              type="tel"
              autoComplete="tel"
              value={form.ownerPhone}
              onChange={(e) => update("ownerPhone", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="registeredAddress">Registered Address</Label>
            <Textarea
              id="registeredAddress"
              autoComplete="street-address"
              value={form.registeredAddress}
              onChange={(e) => update("registeredAddress", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Set a Password</Label>
            <Input
              id="password"
              name="new-password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
            />
            <p className="mt-1 text-[13px] text-text-secondary">At least 8 characters.</p>
          </div>
        </WizardShell>
      )}

      {step === 3 && (
        <WizardShell
          step={3}
          totalSteps={TOTAL_STEPS}
          title="What do you do?"
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
          nextDisabled={!canProceed}
        >
          <div>
            <Label>Service Categories (up to 5)</Label>
            <CheckboxGroup
              options={categories.map((c) => ({ id: c.id, label: c.name }))}
              selected={form.categoryIds}
              onChange={(ids) => update("categoryIds", ids)}
              max={5}
            />
          </div>
          <div>
            <Label htmlFor="requestedCategory">Don&apos;t see your trade? Request a new category</Label>
            <Input
              id="requestedCategory"
              value={form.requestedCategory}
              onChange={(e) => update("requestedCategory", e.target.value)}
              placeholder="Optional — won't block your registration"
            />
          </div>
        </WizardShell>
      )}

      {step === 4 && (
        <WizardShell
          step={4}
          totalSteps={TOTAL_STEPS}
          title="Where do you work?"
          onBack={() => setStep(3)}
          onNext={() => setStep(5)}
          nextDisabled={!canProceed}
        >
          <div>
            <Label>Cities Served</Label>
            <CheckboxGroup
              options={cities.map((c) => ({ id: c.id, label: c.name }))}
              selected={form.cityIds}
              onChange={(ids) => update("cityIds", ids)}
            />
          </div>
          <div>
            <Label>Societies Already Serviced</Label>
            <TagInput
              tags={form.societiesServiced}
              onChange={(tags) => update("societiesServiced", tags)}
              placeholder="Type a society name, press Enter"
            />
          </div>
        </WizardShell>
      )}

      {step === 5 && (
        <WizardShell
          step={5}
          totalSteps={TOTAL_STEPS}
          title="A few more details"
          onBack={() => setStep(4)}
          onNext={() => setStep(6)}
        >
          <div>
            <Label htmlFor="yearsInBusiness">Years in Business</Label>
            <Input
              id="yearsInBusiness"
              type="number"
              min={0}
              value={form.yearsInBusiness}
              onChange={(e) => update("yearsInBusiness", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="description">Short description about your business</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
        </WizardShell>
      )}

      {step === 6 && (
        <WizardShell step={6} totalSteps={TOTAL_STEPS} title="Review &amp; submit" onBack={() => setStep(5)}>
          <ReviewRow label="Company" value={form.name} />
          <ReviewRow label="Business Type" value={form.businessType} />
          <ReviewRow label="Owner" value={`${form.ownerName} · ${form.ownerEmail} · ${form.ownerPhone}`} />
          <ReviewRow label="Address" value={form.registeredAddress} />
          <ReviewRow
            label="Categories"
            value={categories.filter((c) => form.categoryIds.includes(c.id)).map((c) => c.name).join(", ")}
          />
          <ReviewRow
            label="Cities"
            value={cities.filter((c) => form.cityIds.includes(c.id)).map((c) => c.name).join(", ")}
          />
          {error && <p className="text-[13px] text-status-error">{error}</p>}
          <Button type="button" className="w-full" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit registration"}
          </Button>
        </WizardShell>
      )}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] text-text-secondary">{label}</p>
      <p className="text-[15px] text-text-primary">{value || "—"}</p>
    </div>
  );
}
