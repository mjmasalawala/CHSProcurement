import { prisma } from "@/lib/prisma";
import { VendorRegistrationWizard } from "./wizard";

// Categories/cities are admin-managed (M3) — must reflect live data, not a
// build-time snapshot.
export const dynamic = "force-dynamic";

export default async function VendorRegistrationPage() {
  const [categories, cities] = await Promise.all([
    prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.city.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <VendorRegistrationWizard categories={categories} cities={cities} />
    </main>
  );
}
