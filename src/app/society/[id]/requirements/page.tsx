import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyPagePermission } from "@/lib/society-auth";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function statusFor(status: string, deadline: Date): string {
  switch (status) {
    case "AWAITING_APPROVAL":
      return "Awaiting Office Bearer approval";
    case "RETURNED_TO_MANAGER":
      return "Returned to you";
    case "FINALIZED":
      return "Finalized";
    default:
      return deadline.getTime() > Date.now() ? "Open" : "Awaiting review";
  }
}

export default async function SocietyRequirementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSocietyPagePermission(id, PERMISSIONS.CREATE_REQUIREMENT, `/society/${id}/requirements`);

  const requirements = await prisma.requirement.findMany({
    where: { societyId: id },
    include: {
      category: true,
      _count: { select: { invites: true, bids: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold text-text-primary">Requirements</h1>
        <Link href={`/society/${id}/requirements/new`}>
          <Button>New requirement</Button>
        </Link>
      </div>

      {requirements.length === 0 ? (
        <p className="text-[13px] text-text-secondary">No requirements raised yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {requirements.map((req) => (
            <Link
              key={req.id}
              href={`/society/${id}/requirements/${req.id}`}
              className="flex items-center justify-between rounded-lg border border-border-subtle p-4 hover:bg-background-secondary"
            >
              <div>
                <p className="text-[15px] font-medium text-text-primary">{req.category.name}</p>
                <p className="text-[13px] text-text-secondary">{req.description.slice(0, 80)}</p>
                <p className="text-[13px] text-text-secondary">
                  {req._count.invites} vendors invited · {req._count.bids} bids · deadline{" "}
                  {req.bidDeadline.toLocaleString()}
                </p>
              </div>
              <p className="text-[13px] font-medium text-text-primary">
                {statusFor(req.status, req.bidDeadline)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
