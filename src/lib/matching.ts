import { prisma } from "@/lib/prisma";

/**
 * The matching engine, society-portal-spec.md Section 5 / architecture doc
 * Section 7: category + city match against Active vendors. This is the
 * platform's core fairness control — the Manager never chooses who gets
 * invited, only this function does.
 */
export async function matchVendors(categoryId: string, cityId: string) {
  return prisma.vendorCompany.findMany({
    where: {
      status: "ACTIVE",
      serviceCategories: { some: { id: categoryId } },
      citiesServed: { some: { id: cityId } },
    },
    select: { id: true, ownerEmail: true, ownerPhone: true },
  });
}
