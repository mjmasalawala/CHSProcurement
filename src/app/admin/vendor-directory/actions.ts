"use server";

import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireActionPermission } from "@/lib/admin-auth";
import { notifyVendorSuggested } from "@/lib/notifications";
import { getBaseUrl } from "@/lib/base-url";
import { revalidatePath } from "next/cache";

// Vendor Owners have no Invite/RoleAssignment record of their own (they
// create credentials directly at signup — see the Invite model's schema
// comment), so "resend" for a not-yet-registered vendor means re-sending the
// same suggestion email a society originally triggered (suggest-vendor
// actions.ts), not resending an Invite row.
export async function resendVendorInvitation(
  vendorSuggestionId: string,
): Promise<{ error: string } | undefined> {
  await requireActionPermission(PERMISSIONS.VENDOR_DIRECTORY_ACCESS);

  const suggestion = await prisma.vendorSuggestion.findUnique({
    where: { id: vendorSuggestionId },
    include: { society: true, suggestedByUser: true },
  });
  if (!suggestion) return { error: "Invitation not found." };

  const base = getBaseUrl();
  const registerParams = new URLSearchParams({
    name: suggestion.vendorName,
    email: suggestion.vendorEmail,
  });
  if (suggestion.vendorPhone) registerParams.set("phone", suggestion.vendorPhone);

  try {
    await notifyVendorSuggested({
      vendorName: suggestion.vendorName,
      vendorEmail: suggestion.vendorEmail,
      vendorPhone: suggestion.vendorPhone,
      suggestedByName: suggestion.suggestedByUser.name ?? `a member of ${suggestion.society.name}`,
      societyName: suggestion.society.name,
      registerUrl: `${base}/register/vendor?${registerParams.toString()}`,
    });
  } catch (err) {
    console.error("Failed to resend vendor invitation:", err);
    return { error: "Failed to send the invitation email. Please try again." };
  }

  revalidatePath("/admin/vendor-directory");
}
