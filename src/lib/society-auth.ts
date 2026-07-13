import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { SessionRoleAssignment } from "@/types/next-auth";
import type { Permission } from "@/lib/permissions";

/**
 * Entity-scoped equivalent of admin-auth.ts's helpers, for the Society
 * module — see vendor-auth.ts for the same pattern on the Vendor side. A
 * session can hold role assignments across several societies (a Manager
 * across multiple societies, society-portal-spec.md Section 2), so we
 * always resolve the one assignment matching this specific societyId.
 */
async function resolveAssignment(societyId: string) {
  const session = await auth();
  const assignment = session?.user.roleAssignments.find(
    (ra) => ra.entityType === "SOCIETY" && ra.entityId === societyId,
  );
  return { session, assignment };
}

export async function requireSocietyAssignment(
  societyId: string,
  pathname: string,
): Promise<SessionRoleAssignment> {
  const { session, assignment } = await resolveAssignment(societyId);
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
  if (!assignment) redirect("/app");
  return assignment;
}

export async function requireSocietyPagePermission(
  societyId: string,
  permission: Permission,
  pathname: string,
): Promise<SessionRoleAssignment> {
  const assignment = await requireSocietyAssignment(societyId, pathname);
  if (!assignment.permissions.includes(permission)) redirect(`/society/${societyId}`);
  return assignment;
}

/**
 * Same as requireSocietyPagePermission, but for pages reachable by more than
 * one permission (e.g. Members: MANAGE_USERS for the Secretary's invite/
 * deactivate actions, PROPOSE_MEMBER_REMOVAL/APPROVE_MEMBER_REMOVAL for any
 * Office Bearer's removal workflow) — deliberately a list of distinct
 * permissions checked with "any", not one shared flag, so each stays
 * independently grantable without affecting page access for the others.
 */
export async function requireSocietyPageAnyPermission(
  societyId: string,
  permissions: Permission[],
  pathname: string,
): Promise<SessionRoleAssignment> {
  const assignment = await requireSocietyAssignment(societyId, pathname);
  if (!permissions.some((p) => assignment.permissions.includes(p))) redirect(`/society/${societyId}`);
  return assignment;
}

export async function requireSocietyActionPermission(
  societyId: string,
  permission: Permission,
): Promise<SessionRoleAssignment> {
  const { assignment } = await resolveAssignment(societyId);
  if (!assignment || !assignment.permissions.includes(permission)) {
    throw new Error("Not authorized.");
  }
  return assignment;
}
