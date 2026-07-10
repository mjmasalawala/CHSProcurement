import { redirect } from "next/navigation";
import { auth } from "@/auth";
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
): Promise<SessionRoleAssignment> {
  const { assignment } = await resolveAssignment(vendorCompanyId);
  if (!assignment || !assignment.permissions.includes(permission)) {
    throw new Error("Not authorized.");
  }
  return assignment;
}
