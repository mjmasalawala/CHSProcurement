import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/base-url";
import { notifyVendorSuggested } from "@/lib/notifications";

/**
 * Re-sends the email + WhatsApp invite (notifyVendorSuggested — both
 * channels fire from that one function) for an existing VendorSuggestion.
 * Shared by the society "Suggest a Vendor" page's own "Resend Invite"
 * button and the admin vendor directory's — each caller does its own
 * permission check first (society vs. admin), this just does the lookup +
 * send + shared error handling so the two don't drift apart.
 */
export async function resendVendorSuggestionMessage(vendorSuggestionId: string): Promise<{ error: string } | undefined> {
  const suggestion = await prisma.vendorSuggestion.findUnique({
    where: { id: vendorSuggestionId },
    include: { society: true, suggestedByUser: true },
  });
  if (!suggestion) return { error: "Invitation not found." };

  const base = getBaseUrl();
  const registerParams = new URLSearchParams({ name: suggestion.vendorName, email: suggestion.vendorEmail });
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
    console.error("Failed to resend vendor suggestion:", err);
    return { error: "Failed to send the invitation. Please try again." };
  }
}
