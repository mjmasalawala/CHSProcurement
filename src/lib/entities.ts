import { prisma } from "@/lib/prisma";
import type { EntityType } from "@/generated/prisma/enums";

/**
 * RoleAssignment.entityId is a loose reference (see schema comment) — this is
 * the one place that resolves it to a display name, so callers never have to
 * know which table entityType points into.
 */
export async function getEntityName(
  entityType: EntityType,
  entityId: string | null,
): Promise<string | null> {
  if (!entityId) return null;

  switch (entityType) {
    case "VENDOR_COMPANY": {
      const vendor = await prisma.vendorCompany.findUnique({
        where: { id: entityId },
        select: { name: true },
      });
      return vendor?.name ?? null;
    }
    case "SOCIETY": {
      const society = await prisma.society.findUnique({
        where: { id: entityId },
        select: { name: true },
      });
      return society?.name ?? null;
    }
    case "PLATFORM":
      return "ProSoc";
  }
}
