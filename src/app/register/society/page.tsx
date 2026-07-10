import { prisma } from "@/lib/prisma";
import { SocietyRegistrationWizard } from "./wizard";

// Cities are admin-managed (M3) — must reflect live data, not a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function SocietyRegistrationPage() {
  const cities = await prisma.city.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <SocietyRegistrationWizard cities={cities} />
    </main>
  );
}
