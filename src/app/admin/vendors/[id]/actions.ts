"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/permissions";
import { requireActionPermission } from "@/lib/admin-auth";
import { notifyApproval, notifyRejection, notifyVendorStatusChanged } from "@/lib/notifications";
import { syncVendorRequirementMatches } from "@/lib/matching";
import { getBaseUrl } from "@/lib/base-url";
import { revalidatePath } from "next/cache";
import type { VendorProfileInput } from "@/app/vendor/[id]/profile/actions";

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

  const base = getBaseUrl();
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

// Reversible, unlike approve/reject: pulls an ACTIVE vendor out of new
// matching (lib/matching.ts already filters status: "ACTIVE") without
// touching its existing role assignments, bids, or open invites.
export async function suspendVendor(vendorCompanyId: string): Promise<void> {
  await requireActionPermission(PERMISSIONS.VENDOR_QUEUE_ACCESS);

  const vendor = await prisma.vendorCompany.update({
    where: { id: vendorCompanyId },
    data: { status: "SUSPENDED" },
  });

  try {
    await notifyVendorStatusChanged({
      vendorName: vendor.name,
      contactEmail: vendor.ownerEmail,
      contactPhone: vendor.ownerPhone,
      suspended: true,
    });
  } catch (err) {
    console.error("Failed to notify vendor of suspension:", err);
  }

  revalidatePath(`/admin/vendors/${vendorCompanyId}`);
  revalidatePath("/admin/vendors");
}

// Admin-side equivalent of vendor/[id]/profile/actions.ts's updateVendorProfile
// — same input shape and validation (reuses ProfileForm), gated on the admin
// permission instead of the vendor's own RoleAssignment.
export async function updateVendorProfileAdmin(
  vendorCompanyId: string,
  input: VendorProfileInput,
): Promise<{ error: string } | undefined> {
  await requireActionPermission(PERMISSIONS.VENDOR_QUEUE_ACCESS);

  if (input.categoryIds.length > 5) {
    return { error: "You can select up to 5 service categories." };
  }

  await prisma.vendorCompany.update({
    where: { id: vendorCompanyId },
    data: {
      name: input.name,
      businessType: input.businessType as Prisma.VendorCompanyUpdateInput["businessType"],
      ownerName: input.ownerName,
      ownerPhone: input.ownerPhone,
      registeredAddress: input.registeredAddress,
      yearsInBusiness: input.yearsInBusiness ? Number(input.yearsInBusiness) : null,
      description: input.description || null,
      societiesServiced: input.societiesServiced,
      serviceCategories: { set: input.categoryIds.map((id) => ({ id })) },
      citiesServed: { set: input.cityIds.map((id) => ({ id })) },
    },
  });

  await syncVendorRequirementMatches(vendorCompanyId);

  revalidatePath(`/admin/vendors/${vendorCompanyId}`);
  revalidatePath(`/admin/vendors/${vendorCompanyId}/edit`);
}

export async function reactivateVendor(vendorCompanyId: string): Promise<void> {
  await requireActionPermission(PERMISSIONS.VENDOR_QUEUE_ACCESS);

  const vendor = await prisma.vendorCompany.update({
    where: { id: vendorCompanyId },
    data: { status: "ACTIVE" },
  });

  try {
    await notifyVendorStatusChanged({
      vendorName: vendor.name,
      contactEmail: vendor.ownerEmail,
      contactPhone: vendor.ownerPhone,
      suspended: false,
    });
  } catch (err) {
    console.error("Failed to notify vendor of reactivation:", err);
  }

  await syncVendorRequirementMatches(vendorCompanyId);

  revalidatePath(`/admin/vendors/${vendorCompanyId}`);
  revalidatePath("/admin/vendors");
}
