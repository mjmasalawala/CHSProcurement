"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { notifyRejection } from "@/lib/email";
import { revalidatePath } from "next/cache";

// session.user.roleAssignments is already ACTIVE-only (see auth.ts jwt
// callback), so a plain permissions.includes() check is sufficient here.
async function requireVendorQueueAccess() {
  const session = await auth();
  const assignment = session?.user.roleAssignments.find((ra) =>
    ra.permissions.includes(PERMISSIONS.VENDOR_QUEUE_ACCESS),
  );
  if (!assignment) throw new Error("Not authorized.");
}

// The Vendor Owner already has a working login from registration (product
// decision — vendor login is immediate, unlike Society/Secretary), so
// approval here is just a status flip, no invite to send.
export async function approveVendor(vendorCompanyId: string): Promise<void> {
  await requireVendorQueueAccess();

  await prisma.vendorCompany.update({
    where: { id: vendorCompanyId },
    data: { status: "ACTIVE" },
  });

  revalidatePath(`/admin/vendors/${vendorCompanyId}`);
}

export async function rejectVendor(vendorCompanyId: string, reason: string): Promise<void> {
  await requireVendorQueueAccess();

  const vendor = await prisma.vendorCompany.update({
    where: { id: vendorCompanyId },
    data: { status: "REJECTED", rejectionReason: reason || null },
  });

  await notifyRejection({
    type: "Vendor",
    name: vendor.name,
    contactEmail: vendor.ownerEmail,
    reason,
  });

  revalidatePath(`/admin/vendors/${vendorCompanyId}`);
}
