"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyActionPermission } from "@/lib/society-auth";
import { matchVendors } from "@/lib/matching";
import { MIN_ACTIVE_OFFICE_BEARERS, countActiveOfficeBearers } from "@/lib/society-ob";
import { notifyRequirementMatched } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

export interface RequirementCreationInput {
  categoryIds: string[];
  name: string;
  description: string;
  bidDeadline: string;
}

/**
 * On submit, runs the matching engine (category + city match against Active
 * vendors) and invites the resulting pool automatically — the Manager never
 * chooses who gets invited (society-portal-spec.md Section 5).
 */
export async function createRequirement(
  societyId: string,
  input: RequirementCreationInput,
): Promise<{ error: string } | undefined> {
  await requireSocietyActionPermission(societyId, PERMISSIONS.CREATE_REQUIREMENT);

  // Mirrors the page-level guard in requirements/new/page.tsx — kept here
  // too since this action is the actual enforcement boundary.
  const obCount = await countActiveOfficeBearers(societyId);
  if (obCount < MIN_ACTIVE_OFFICE_BEARERS) {
    return {
      error: `This society needs at least ${MIN_ACTIVE_OFFICE_BEARERS} active Office Bearers before a requirement can be raised.`,
    };
  }

  if (
    !input.categoryIds.length ||
    !input.name.trim() ||
    !input.description.trim() ||
    !input.bidDeadline
  ) {
    return { error: "Project name, at least one category, description, and deadline are required." };
  }

  const bidDeadline = new Date(input.bidDeadline);
  if (bidDeadline.getTime() <= Date.now()) {
    return { error: "Bid deadline must be in the future." };
  }

  const society = await prisma.society.findUniqueOrThrow({
    where: { id: societyId },
    select: { name: true, cityId: true },
  });

  const requirement = await prisma.requirement.create({
    data: {
      societyId,
      categories: { connect: input.categoryIds.map((id) => ({ id })) },
      name: input.name.trim(),
      description: input.description.trim(),
      // Not captured in the v1 creation form (product decision) — schema
      // field kept for a possible future re-introduction.
      urgency: "ROUTINE",
      bidDeadline,
    },
    include: { categories: true },
  });

  // ANY-match: a vendor is invited if they service at least one of the
  // requirement's categories, not necessarily all of them (lib/matching.ts).
  const matched = await matchVendors(input.categoryIds, society.cityId);
  if (matched.length > 0) {
    await prisma.requirementInvite.createMany({
      data: matched.map((v) => ({ requirementId: requirement.id, vendorCompanyId: v.id })),
    });

    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const categoryNames = requirement.categories.map((c) => c.name).join(", ");
    try {
      await Promise.all(
        matched.map((v) =>
          notifyRequirementMatched({
            vendorEmail: v.ownerEmail,
            vendorPhone: v.ownerPhone,
            categoryName: categoryNames,
            societyName: society.name,
            reviewUrl: `${base}/vendor/${v.id}/requirements/${requirement.id}`,
          }),
        ),
      );
    } catch (err) {
      // The Requirement and its invites are already committed — a
      // notification failure (e.g. Resend sandbox rejecting an unverified
      // recipient) shouldn't fail the whole action and leave the Manager
      // thinking nothing happened.
      console.error("Failed to notify matched vendors of new requirement:", err);
    }
  }

  revalidatePath(`/society/${societyId}/requirements`);
  redirect(`/society/${societyId}/requirements/${requirement.id}`);
}
