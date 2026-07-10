import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePagePermission } from "@/lib/admin-auth";
import { Card } from "@/components/ui/card";
import { ApproveRejectPanel } from "./panel";

export const dynamic = "force-dynamic";

export default async function AdminVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission(PERMISSIONS.VENDOR_QUEUE_ACCESS, `/admin/vendors/${id}`);

  const vendor = await prisma.vendorCompany.findUnique({
    where: { id },
    include: { serviceCategories: true, citiesServed: true },
  });
  if (!vendor) notFound();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <Link href="/admin/vendors" className="text-[13px] text-text-secondary underline hover:text-text-primary">
        ← Back to Vendors
      </Link>
      <div>
        <h1 className="text-[24px] font-bold text-text-primary">{vendor.name}</h1>
        <p className="text-[13px] text-text-secondary">Status: {vendor.status}</p>
      </div>

      <Card className="flex flex-col gap-3">
        <Row label="Business Type" value={vendor.businessType} />
        <Row label="Owner" value={`${vendor.ownerName} · ${vendor.ownerEmail} · ${vendor.ownerPhone}`} />
        <Row label="Address" value={vendor.registeredAddress} />
        <Row label="Categories" value={vendor.serviceCategories.map((c) => c.name).join(", ") || "—"} />
        <Row label="Cities" value={vendor.citiesServed.map((c) => c.name).join(", ") || "—"} />
      </Card>

      <ApproveRejectPanel vendorCompanyId={vendor.id} status={vendor.status} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] text-text-secondary">{label}</p>
      <p className="text-[15px] text-text-primary">{value}</p>
    </div>
  );
}
