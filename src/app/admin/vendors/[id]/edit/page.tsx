import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePagePermission } from "@/lib/admin-auth";
import { ProfileForm } from "@/app/vendor/[id]/profile/form";
import { updateVendorProfileAdmin } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminEditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission(PERMISSIONS.VENDOR_QUEUE_ACCESS, `/admin/vendors/${id}/edit`);

  const [vendor, categories, cities] = await Promise.all([
    prisma.vendorCompany.findUnique({
      where: { id },
      include: { serviceCategories: true, citiesServed: true },
    }),
    prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.city.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!vendor) notFound();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <Link
        href={`/admin/vendors/${id}`}
        className="text-[13px] text-text-secondary underline hover:text-text-primary"
      >
        ← Back to Vendor
      </Link>
      <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Edit {vendor.name}</h1>
      <ProfileForm vendorCompanyId={id} vendor={vendor} categories={categories} cities={cities} onSave={updateVendorProfileAdmin} />
    </div>
  );
}
