"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyActionPermission } from "@/lib/society-auth";
import { notifyVendorSuggested } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

export interface VendorSuggestionInput {
  vendorName: string;
  vendorPhone: string;
  vendorEmail: string;
}

const ROLE_LABELS: Record<string, string> = {
  MANAGER: "Manager",
  CHAIRMAN: "Chairman",
  SECRETARY: "Secretary",
  TREASURER: "Treasurer",
};

export async function suggestVendor(
  societyId: string,
  input: VendorSuggestionInput,
): Promise<{ error: string } | undefined> {
  const assignment = await requireSocietyActionPermission(societyId, PERMISSIONS.CREATE_REQUIREMENT);
  const session = await auth();
  if (!session) return { error: "Not authorized." };

  const vendorName = input.vendorName.trim();
  const vendorPhone = input.vendorPhone.trim();
  const vendorEmail = input.vendorEmail.trim().toLowerCase();
  if (!vendorName || !vendorEmail) {
    return { error: "Vendor name and email are required." };
  }

  const society = await prisma.society.findUniqueOrThrow({
    where: { id: societyId },
    select: { name: true },
  });

  await prisma.vendorSuggestion.create({
    data: {
      societyId,
      suggestedByUserId: session.user.id,
      vendorName,
      vendorPhone: vendorPhone || null,
      vendorEmail,
    },
  });

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const registerParams = new URLSearchParams({ name: vendorName, email: vendorEmail });
  if (vendorPhone) registerParams.set("phone", vendorPhone);

  try {
    await notifyVendorSuggested({
      vendorName,
      vendorEmail,
      vendorPhone: vendorPhone || null,
      // session.user.name is only ever populated for Google-authenticated
      // users — the invite-acceptance flow (email/password) never collects
      // a name — so fall back to a role title rather than ever showing the
      // suggester's raw email address to the invited vendor.
      suggestedByName: session.user.name ?? `The ${ROLE_LABELS[assignment.role] ?? assignment.role}`,
      societyName: society.name,
      registerUrl: `${base}/register/vendor?${registerParams.toString()}`,
    });
  } catch (err) {
    // The suggestion is already recorded — a notification failure shouldn't
    // fail the whole action (same pattern as every other notify* call site).
    console.error("Failed to notify suggested vendor:", err);
    revalidatePath(`/society/${societyId}/suggest-vendor`);
    return { error: "Vendor suggestion saved, but the invite email failed to send. Please contact support." };
  }

  revalidatePath(`/society/${societyId}/suggest-vendor`);
}
