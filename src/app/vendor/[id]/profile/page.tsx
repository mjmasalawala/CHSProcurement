import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorPagePermission } from "@/lib/vendor-auth";
import { ProfileForm } from "./form";

export const dynamic = "force-dynamic";

export default async function VendorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireVendorPagePermission(id, PERMISSIONS.EDIT_COMPANY_PROFILE, `/vendor/${id}/profile`);

  const [vendor, categories, cities] = await Promise.all([
    prisma.vendorCompany.findUniqueOrThrow({
      where: { id },
      include: { serviceCategories: true, citiesServed: true },
    }),
    prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.city.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Profile</h1>
      <ProfileForm vendorCompanyId={id} vendor={vendor} categories={categories} cities={cities} />
    </div>
  );
}
