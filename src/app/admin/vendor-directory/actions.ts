"use server";

import { PERMISSIONS } from "@/lib/permissions";
import { requireActionPermission } from "@/lib/admin-auth";
import { resendVendorSuggestionMessage } from "@/lib/vendor-suggestion";
import { revalidatePath } from "next/cache";

// Vendor Owners have no Invite/RoleAssignment record of their own (they
// create credentials directly at signup — see the Invite model's schema
// comment), so "resend" for a not-yet-registered vendor means re-sending the
// same suggestion email + WhatsApp message a society originally triggered
// (suggest-vendor actions.ts / lib/vendor-suggestion.ts), not resending an
// Invite row.
export async function resendVendorInvitation(
  vendorSuggestionId: string,
): Promise<{ error: string } | undefined> {
  await requireActionPermission(PERMISSIONS.VENDOR_DIRECTORY_ACCESS);

  const result = await resendVendorSuggestionMessage(vendorSuggestionId);
  if (result?.error) return result;

  revalidatePath("/admin/vendor-directory");
}
