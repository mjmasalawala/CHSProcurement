"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyActionPermission } from "@/lib/society-auth";
import { matchVendors } from "@/lib/matching";
import { revalidatePath } from "next/cache";

export interface RequirementCreationInput {
  categoryId: string;
  description: string;
  budgetBand: string;
  urgency: string;
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

  if (!input.categoryId || !input.description.trim() || !input.urgency || !input.bidDeadline) {
    return { error: "Category, description, urgency, and deadline are required." };
  }

  const bidDeadline = new Date(input.bidDeadline);
  if (bidDeadline.getTime() <= Date.now()) {
    return { error: "Bid deadline must be in the future." };
  }

  const society = await prisma.society.findUniqueOrThrow({
    where: { id: societyId },
    select: { cityId: true },
  });

  const requirement = await prisma.requirement.create({
    data: {
      societyId,
      categoryId: input.categoryId,
      description: input.description.trim(),
      urgency: input.urgency as "ROUTINE" | "URGENT",
      budgetBand: input.budgetBand.trim() || null,
      bidDeadline,
    },
  });

  const matched = await matchVendors(input.categoryId, society.cityId);
  if (matched.length > 0) {
    await prisma.requirementInvite.createMany({
      data: matched.map((v) => ({ requirementId: requirement.id, vendorCompanyId: v.id })),
    });
  }

  revalidatePath(`/society/${societyId}/requirements`);
  redirect(`/society/${societyId}/requirements/${requirement.id}`);
}
