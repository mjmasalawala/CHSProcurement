import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePagePermission } from "@/lib/admin-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-badge";
import { ApproveRejectPanel } from "./panel";

export const dynamic = "force-dynamic";

export default async function AdminVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission(PERMISSIONS.VENDOR_QUEUE_ACCESS, `/admin/vendors/${id}`);

  const vendor = await prisma.vendorCompany.findUnique({
    where: { id },
    include: { serviceCategories: true, citiesServed: true, categoryRequests: true },
  });
  if (!vendor) notFound();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <Link href="/admin/vendors" className="text-[13px] text-text-secondary underline hover:text-text-primary">
        ← Back to Vendors
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-bold tracking-tight text-text-primary">{vendor.name}</h1>
          <Badge tone={statusTone(vendor.status)} className="w-fit">
            {statusLabel(vendor.status)}
          </Badge>
        </div>
        <Link
          href={`/admin/vendors/${id}/edit`}
          className="shrink-0 rounded-lg border border-border-strong bg-background-primary px-4 py-2 text-[15px] font-semibold text-text-primary shadow-xs transition-colors duration-150 hover:bg-background-secondary"
        >
          Edit profile
        </Link>
      </div>

      <Card className="flex flex-col gap-3">
        <Row label="Business Type" value={vendor.businessType} />
        <Row label="Owner" value={`${vendor.ownerName} · ${vendor.ownerEmail} · ${vendor.ownerPhone}`} />
        <Row label="Address" value={vendor.registeredAddress} />
        <Row label="Categories" value={vendor.serviceCategories.map((c) => c.name).join(", ") || "—"} />
        <Row
          label="Requested Category"
          value={vendor.categoryRequests.map((r) => `${r.name} (${r.status.toLowerCase()})`).join(", ") || "—"}
        />
        <Row label="Cities" value={vendor.citiesServed.map((c) => c.name).join(", ") || "—"} />
        <Row label="Societies Already Serviced" value={vendor.societiesServiced.join(", ") || "—"} />
        <Row label="Years in Business" value={vendor.yearsInBusiness != null ? String(vendor.yearsInBusiness) : "—"} />
        <Row label="Description" value={vendor.description || "—"} />
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
