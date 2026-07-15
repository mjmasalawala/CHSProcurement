import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePagePermission } from "@/lib/admin-auth";
import { Badge } from "@/components/ui/badge";
import { AddCityForm, ToggleActiveButton } from "./controls";

export const dynamic = "force-dynamic";

export default async function CitiesPage() {
  await requirePagePermission(PERMISSIONS.CITY_MANAGEMENT, "/admin/cities");

  const cities = await prisma.city.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Cities</h1>

      <AddCityForm />

      <div className="flex flex-col gap-2">
        {cities.map((city) => (
          <div
            key={city.id}
            className="flex items-center justify-between rounded-lg border border-border-subtle p-4"
          >
            <div>
              <p className="text-[15px] font-medium text-text-primary">{city.name}</p>
              <Badge tone={city.active ? "success" : "neutral"} className="mt-1">
                {city.active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <ToggleActiveButton id={city.id} active={city.active} />
          </div>
        ))}
      </div>
    </div>
  );
}
