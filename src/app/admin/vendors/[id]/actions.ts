"use server";

import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireActionPermission } from "@/lib/admin-auth";
import { notifyApproval, notifyRejection } from "@/lib/notifications";
import { syncVendorRequirementMatches } from "@/lib/matching";
import { revalidatePath } from "next/cache";

// The Vendor Owner already has a working login from registration (product
// decision — vendor login is immediate, unlike Society/Secretary), so
// approval here is just a status flip, no invite to send — but they still
// get a notification, per vendor-registration-portal-spec.md Section 9.
export async function approveVendor(vendorCompanyId: string): Promise<void> {
  await requireActionPermission(PERMISSIONS.VENDOR_QUEUE_ACCESS);

  const vendor = await prisma.vendorCompany.update({
    where: { id: vendorCompanyId },
    data: { status: "ACTIVE", approvedAt: new Date() },
  });

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  try {
    await notifyApproval({
      type: "Vendor",
      name: vendor.name,
      contactEmail: vendor.ownerEmail,
      contactPhone: vendor.ownerPhone,
      dashboardUrl: `${base}/vendor/${vendorCompanyId}/requirements`,
    });
  } catch (err) {
    console.error("Failed to notify vendor of approval:", err);
  }

  await syncVendorRequirementMatches(vendorCompanyId);

  revalidatePath(`/admin/vendors/${vendorCompanyId}`);
  revalidatePath("/admin/vendors");
}

export async function rejectVendor(vendorCompanyId: string, reason: string): Promise<void> {
  await requireActionPermission(PERMISSIONS.VENDOR_QUEUE_ACCESS);

  const vendor = await prisma.vendorCompany.update({
    where: { id: vendorCompanyId },
    data: { status: "REJECTED", rejectionReason: reason || null },
  });

  try {
    await notifyRejection({
      type: "Vendor",
      name: vendor.name,
      contactEmail: vendor.ownerEmail,
      contactPhone: vendor.ownerPhone,
      reason,
    });
  } catch (err) {
    console.error("Failed to notify vendor of rejection:", err);
  }

  revalidatePath(`/admin/vendors/${vendorCompanyId}`);
  revalidatePath("/admin/vendors");
}
