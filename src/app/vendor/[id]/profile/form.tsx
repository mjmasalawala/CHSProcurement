"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { TagInput } from "@/components/ui/tag-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateVendorProfile, type VendorProfileInput } from "./actions";

const BUSINESS_TYPES = [
  { value: "PROPRIETORSHIP", label: "Proprietorship" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "PRIVATE_LIMITED", label: "Private Limited" },
  { value: "LLP", label: "LLP" },
  { value: "OTHER", label: "Other" },
];

interface Props {
  vendorCompanyId: string;
  vendor: {
    name: string;
    businessType: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    registeredAddress: string;
    yearsInBusiness: number | null;
    description: string | null;
    societiesServiced: string[];
    serviceCategories: { id: string; name: string }[];
    citiesServed: { id: string; name: string }[];
  };
  categories: { id: string; name: string }[];
  cities: { id: string; name: string }[];
}

export function ProfileForm({ vendorCompanyId, vendor, categories, cities }: Props) {
  const [form, setForm] = useState<VendorProfileInput>({
    name: vendor.name,
    businessType: vendor.businessType,
    ownerName: vendor.ownerName,
    ownerPhone: vendor.ownerPhone,
    registeredAddress: vendor.registeredAddress,
    categoryIds: vendor.serviceCategories.map((c) => c.id),
    cityIds: vendor.citiesServed.map((c) => c.id),
    societiesServiced: vendor.societiesServiced,
    yearsInBusiness: vendor.yearsInBusiness?.toString() ?? "",
    description: vendor.description ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof VendorProfileInput>(key: K, value: VendorProfileInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    await updateVendorProfile(vendorCompanyId, form);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <div>
          <Label htmlFor="ownerEmail">Owner Email (login)</Label>
          <Input id="ownerEmail" value={vendor.ownerEmail} disabled />
        </div>
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
            {BUSINESS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ownerName">Owner Name</Label>
          <Input id="ownerName" value={form.ownerName} onChange={(e) => update("ownerName", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ownerPhone">Owner Phone</Label>
          <Input
            id="ownerPhone"
            type="tel"
            value={form.ownerPhone}
            onChange={(e) => update("ownerPhone", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="registeredAddress">Registered Address</Label>
          <Textarea
            id="registeredAddress"
            value={form.registeredAddress}
            onChange={(e) => update("registeredAddress", e.target.value)}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <Label>Service Categories</Label>
          <CheckboxGroup
            options={categories.map((c) => ({ id: c.id, label: c.name }))}
            selected={form.categoryIds}
            onChange={(ids) => update("categoryIds", ids)}
          />
        </div>
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
      </Card>

      <Card className="flex flex-col gap-4">
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
          <Label htmlFor="description">Short Description / About</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {saved && <span className="text-[13px] text-status-success">Saved.</span>}
      </div>
    </div>
  );
}
