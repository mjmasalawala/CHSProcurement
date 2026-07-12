import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePagePermission } from "@/lib/admin-auth";
import { CategoryRequestRow } from "./row";

export const dynamic = "force-dynamic";

export default async function CategoryRequestsPage() {
  await requirePagePermission(PERMISSIONS.TAXONOMY_MANAGEMENT, "/admin/category-requests");

  const requests = await prisma.categoryRequest.findMany({
    where: { status: "PENDING" },
    include: { vendorCompany: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Category Requests</h1>

      {requests.length === 0 ? (
        <p className="text-[13px] text-text-secondary">No pending category requests.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((request) => (
            <CategoryRequestRow
              key={request.id}
              id={request.id}
              name={request.name}
              vendorName={request.vendorCompany?.name ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
