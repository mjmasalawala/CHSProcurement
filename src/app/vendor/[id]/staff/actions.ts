"use server";

import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorActionPermission } from "@/lib/vendor-auth";
import { createInvite } from "@/lib/invite";
import { revalidatePath } from "next/cache";

export async function inviteStaff(
  vendorCompanyId: string,
  email: string,
): Promise<{ error: string } | undefined> {
  await requireVendorActionPermission(vendorCompanyId, PERMISSIONS.MANAGE_STAFF);

  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Email is required." };

  const existing = await prisma.roleAssignment.findFirst({
    where: {
      entityType: "VENDOR_COMPANY",
      entityId: vendorCompanyId,
      role: "VENDOR_STAFF",
      status: { in: ["PENDING", "ACTIVE"] },
      user: { email: trimmed },
    },
  });
  if (existing) return { error: "This person is already staff (or has a pending invite)." };

  await createInvite({
    email: trimmed,
    entityType: "VENDOR_COMPANY",
    entityId: vendorCompanyId,
    role: "VENDOR_STAFF",
  });

  revalidatePath(`/vendor/${vendorCompanyId}/staff`);
}

export async function setStaffActive(
  vendorCompanyId: string,
  roleAssignmentId: string,
  active: boolean,
): Promise<void> {
  await requireVendorActionPermission(vendorCompanyId, PERMISSIONS.MANAGE_STAFF);

  await prisma.roleAssignment.updateMany({
    where: {
      id: roleAssignmentId,
      entityType: "VENDOR_COMPANY",
      entityId: vendorCompanyId,
      role: "VENDOR_STAFF",
      status: { in: ["ACTIVE", "DEACTIVATED"] },
    },
    data: { status: active ? "ACTIVE" : "DEACTIVATED" },
  });

  revalidatePath(`/vendor/${vendorCompanyId}/staff`);
}
