import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyAssignment } from "@/lib/society-auth";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SocietyDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assignment = await requireSocietyAssignment(id, `/society/${id}`);

  const isManager = assignment.permissions.includes(PERMISSIONS.CREATE_REQUIREMENT);

  const [openRequirements, awaitingReview] = isManager
    ? await Promise.all([
        prisma.requirement.count({ where: { societyId: id, bidDeadline: { gt: new Date() } } }),
        prisma.requirement.count({
          where: { societyId: id, bidDeadline: { lte: new Date() }, recommendedBidId: null },
        }),
      ])
    : [null, null];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[24px] font-bold text-text-primary">Dashboard</h1>

      {isManager ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link href={`/society/${id}/requirements`}>
            <Card>
              <p className="text-[13px] text-text-secondary">Open requirements</p>
              <p className="text-[24px] font-bold text-text-primary">{openRequirements}</p>
            </Card>
          </Link>
          <Link href={`/society/${id}/requirements`}>
            <Card>
              <p className="text-[13px] text-text-secondary">Closed, awaiting your review</p>
              <p className="text-[24px] font-bold text-text-primary">{awaitingReview}</p>
            </Card>
          </Link>
        </div>
      ) : (
        <Card>
          <p className="text-[15px] text-text-primary">Nothing needs your attention yet.</p>
          <p className="mt-1 text-[13px] text-text-secondary">
            Quotation approvals land here once the co-approval workflow ships (M6).
          </p>
        </Card>
      )}
    </div>
  );
}
