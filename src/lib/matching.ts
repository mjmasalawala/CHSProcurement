import { prisma } from "@/lib/prisma";

/**
 * The matching engine, society-portal-spec.md Section 5 / architecture doc
 * Section 7: category + city match against Active vendors. This is the
 * platform's core fairness control — the Manager never chooses who gets
 * invited, only this function does.
 *
 * A requirement can span more than one trade (e.g. waterproofing +
 * painting, product decision 2026-07-13) — a vendor matches if they service
 * ANY of the listed categories, not all of them, so a painting vendor still
 * gets invited to a waterproofing+painting job even if they don't do
 * waterproofing.
 */
export async function matchVendors(categoryIds: string[], cityId: string) {
  return prisma.vendorCompany.findMany({
    where: {
      status: "ACTIVE",
      serviceCategories: { some: { id: { in: categoryIds } } },
      citiesServed: { some: { id: cityId } },
    },
    select: { id: true, ownerEmail: true, ownerPhone: true },
  });
}
