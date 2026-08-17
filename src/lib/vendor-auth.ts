import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SessionRoleAssignment } from "@/types/next-auth";
import type { Permission } from "@/lib/permissions";

/**
 * Entity-scoped equivalent of admin-auth.ts's helpers. A session can hold
 * role assignments across several entities (e.g. Vendor Staff at one
 * company, Manager at a society), so — unlike the PLATFORM-only admin
 * check — we always resolve the one assignment that matches this specific
 * vendorCompanyId before checking permissions.
 */
async function resolveAssignment(vendorCompanyId: string) {
  const session = await auth();
  const assignment = session?.user.roleAssignments.find(
    (ra) => ra.entityType === "VENDOR_COMPANY" && ra.entityId === vendorCompanyId,
  );
  return { session, assignment };
}

export async function requireVendorAssignment(
  vendorCompanyId: string,
  pathname: string,
): Promise<SessionRoleAssignment> {
  const { session, assignment } = await resolveAssignment(vendorCompanyId);
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
  if (!assignment) redirect("/app");
  return assignment;
}

export async function requireVendorPagePermission(
  vendorCompanyId: string,
  permission: Permission,
  pathname: string,
): Promise<SessionRoleAssignment> {
  const assignment = await requireVendorAssignment(vendorCompanyId, pathname);
  if (!assignment.permissions.includes(permission)) redirect(`/vendor/${vendorCompanyId}`);
  return assignment;
}

export async function requireVendorActionPermission(
  vendorCompanyId: string,
  permission: Permission,
  // Set for bid-authoring actions (submit/save-draft/AI-suggest/preview) so a
  // suspended vendor can't act on in-flight requirements it's already
  // invited to — plain permission checks above don't look at VendorCompany
  // status, only at the caller's RoleAssignment.
  options?: { requireActiveVendor?: boolean },
): Promise<SessionRoleAssignment> {
  const { assignment } = await resolveAssignment(vendorCompanyId);
  if (!assignment || !assignment.permissions.includes(permission)) {
    throw new Error("Not authorized.");
  }

  if (options?.requireActiveVendor) {
    const vendor = await prisma.vendorCompany.findUnique({
      where: { id: vendorCompanyId },
      select: { status: true },
    });
    if (vendor?.status !== "ACTIVE") {
      throw new Error("This vendor account is suspended and can't bid on requirements.");
    }
  }

  return assignment;
}
