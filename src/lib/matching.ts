import { prisma } from "@/lib/prisma";
import { notifyVendorMatchedRequirements } from "@/lib/notifications";

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

/**
 * Reverse direction of matchVendors: run when a vendor's category/city
 * profile changes (approval, or a profile edit) rather than when a
 * requirement is created. Finds still-open requirements the vendor is now
 * eligible for but wasn't already invited to, invites them, and emails the
 * vendor once per newly matched requirement.
 */
export async function syncVendorRequirementMatches(vendorCompanyId: string): Promise<void> {
  const vendor = await prisma.vendorCompany.findUniqueOrThrow({
    where: { id: vendorCompanyId },
    select: {
      status: true,
      ownerEmail: true,
      ownerPhone: true,
      serviceCategories: { select: { id: true } },
      citiesServed: { select: { id: true } },
    },
  });

  if (vendor.status !== "ACTIVE") return;

  const categoryIds = vendor.serviceCategories.map((c) => c.id);
  const cityIds = vendor.citiesServed.map((c) => c.id);
  if (!categoryIds.length || !cityIds.length) return;

  const requirements = await prisma.requirement.findMany({
    where: {
      status: "OPEN",
      categories: { some: { id: { in: categoryIds } } },
      society: { cityId: { in: cityIds } },
      invites: { none: { vendorCompanyId } },
    },
    select: {
      id: true,
      categories: { select: { name: true } },
      society: { select: { name: true } },
    },
  });
  if (!requirements.length) return;

  await prisma.requirementInvite.createMany({
    data: requirements.map((r) => ({ requirementId: r.id, vendorCompanyId })),
    skipDuplicates: true,
  });

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  try {
    await notifyVendorMatchedRequirements({
      vendorEmail: vendor.ownerEmail,
      vendorPhone: vendor.ownerPhone,
      requirements: requirements.map((r) => ({
        categoryName: r.categories.map((c) => c.name).join(", "),
        societyName: r.society.name,
      })),
      dashboardUrl: `${base}/vendor/${vendorCompanyId}`,
    });
  } catch (err) {
    // The invites above are the side effect that matters — they're already
    // committed, so a failed notification (e.g. Resend send error) shouldn't
    // fail the caller (approveVendor / updateVendorProfile) and make it look
    // like nothing happened. Log for diagnosis, don't rethrow.
    console.error(`Failed to notify vendor ${vendorCompanyId} of matched requirements:`, err);
  }
}
