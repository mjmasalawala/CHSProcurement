import { prisma } from "@/lib/prisma";

export const OB_ROLES = ["CHAIRMAN", "SECRETARY", "TREASURER"] as const;
export const MIN_ACTIVE_OFFICE_BEARERS = 2;

/**
 * Quotation approval always needs 2 signoffs (society-portal-spec.md Section
 * 7.1), regardless of whether the society has 2 or 3 Office Bearers filled —
 * so a requirement can never be raised, and a threshold change never
 * proposed, unless at least 2 are already ACTIVE. The Secretary always
 * exists from activation; Chairman/Treasurer are invited afterwards from
 * /society/[id]/members.
 */
export async function countActiveOfficeBearers(societyId: string): Promise<number> {
  return prisma.roleAssignment.count({
    where: { entityType: "SOCIETY", entityId: societyId, role: { in: [...OB_ROLES] }, status: "ACTIVE" },
  });
}
