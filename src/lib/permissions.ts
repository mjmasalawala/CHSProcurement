import type { RoleAssignment } from "@/generated/prisma/client";
import { RoleName } from "@/generated/prisma/enums";

/**
 * Canonical permission strings. The same string is used on the API layer
 * (to enforce) and the UI layer (to hide/show), per
 * unified-platform-architecture.md Section 8 — never gate on role name alone.
 */
export const PERMISSIONS = {
  // Vendor module
  EDIT_COMPANY_PROFILE: "edit_company_profile",
  MANAGE_STAFF: "manage_staff",
  VIEW_REQUIREMENTS_INBOX: "view_requirements_inbox",
  SUBMIT_BID: "submit_bid",
  VIEW_OWN_BIDS: "view_own_bids",
  VIEW_STAFF_ACTIVITY_LOG: "view_staff_activity_log",

  // Society module
  CREATE_REQUIREMENT: "create_requirement",
  VIEW_BID_COMPARISON: "view_bid_comparison",
  RECOMMEND_BID: "recommend_bid",
  FINALIZE_BELOW_THRESHOLD: "finalize_below_threshold",
  APPROVE_REJECT_QUOTATION: "approve_reject_quotation",
  MANAGE_USERS: "manage_users",
  PROPOSE_THRESHOLD_CHANGE: "propose_threshold_change",
  PROPOSE_MEMBER_REMOVAL: "propose_member_removal",
  APPROVE_MEMBER_REMOVAL: "approve_member_removal",
  VIEW_ARCHIVE: "view_archive",

  // Admin module
  VENDOR_QUEUE_ACCESS: "vendor_queue_access",
  SOCIETY_QUEUE_ACCESS: "society_queue_access",
  VENDOR_DIRECTORY_ACCESS: "vendor_directory_access",
  SOCIETY_DIRECTORY_ACCESS: "society_directory_access",
  TAXONOMY_MANAGEMENT: "taxonomy_management",
  CITY_MANAGEMENT: "city_management",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Default permission set granted at RoleAssignment creation time (invite
 * acceptance / registration approval). Flattening role + special flags into
 * one array here keeps the runtime check a single `.includes(x)` — see
 * hasPermission below. Society/vendor "special permissions" (manage_staff,
 * manage_users, propose_threshold_change) remain independently reassignable
 * afterwards without a code change, per architecture doc Section 4.
 *
 * Note: "Approve Threshold Change" isn't in here — it's the same
 * APPROVE_REJECT_QUOTATION-holding OB roles, excluding whoever proposed it,
 * which is a per-request check, not a static flag (society spec Section 7.1).
 *
 * Product decision, 2026-07-12: all 3 Office Bearer roles (Chairman,
 * Secretary, Treasurer) hold propose_threshold_change, not just
 * Secretary/Treasurer — deviates from the original spec draft, which is
 * updated to match (society-portal-spec.md Sections 6 and 7.1).
 *
 * Product decision, 2026-07-12: Office Bearers (Chairman, Secretary,
 * Treasurer) also hold create_requirement, not just Manager — deviates from
 * the original spec draft (society-portal-spec.md Section 5), which is
 * updated to match.
 *
 * Product decision, 2026-07-13: all 3 Office Bearer roles hold
 * propose_member_removal and approve_member_removal too (member removal —
 * society-portal-spec.md Section 7.2 — reuses the same "propose + different
 * OB approves" co-approval pattern as the threshold). Deliberately its own
 * permission pair rather than reusing APPROVE_REJECT_QUOTATION — even though
 * today's grant is identical (all 3 OB roles), collapsing "approve a
 * quotation" and "approve removing a member" onto the same flag means a
 * future change to one silently changes the other.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<RoleName, Permission[]> = {
  [RoleName.VENDOR_OWNER]: [
    PERMISSIONS.EDIT_COMPANY_PROFILE,
    PERMISSIONS.MANAGE_STAFF,
    PERMISSIONS.VIEW_REQUIREMENTS_INBOX,
    PERMISSIONS.SUBMIT_BID,
    PERMISSIONS.VIEW_OWN_BIDS,
    PERMISSIONS.VIEW_STAFF_ACTIVITY_LOG,
  ],
  [RoleName.VENDOR_STAFF]: [
    PERMISSIONS.VIEW_REQUIREMENTS_INBOX,
    PERMISSIONS.SUBMIT_BID,
    PERMISSIONS.VIEW_OWN_BIDS,
  ],
  [RoleName.MANAGER]: [
    PERMISSIONS.CREATE_REQUIREMENT,
    PERMISSIONS.VIEW_BID_COMPARISON,
    PERMISSIONS.RECOMMEND_BID,
    PERMISSIONS.FINALIZE_BELOW_THRESHOLD,
    PERMISSIONS.VIEW_ARCHIVE,
  ],
  [RoleName.CHAIRMAN]: [
    PERMISSIONS.APPROVE_REJECT_QUOTATION,
    PERMISSIONS.PROPOSE_THRESHOLD_CHANGE,
    PERMISSIONS.PROPOSE_MEMBER_REMOVAL,
    PERMISSIONS.APPROVE_MEMBER_REMOVAL,
    PERMISSIONS.CREATE_REQUIREMENT,
    PERMISSIONS.VIEW_ARCHIVE,
  ],
  [RoleName.SECRETARY]: [
    PERMISSIONS.APPROVE_REJECT_QUOTATION,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.PROPOSE_THRESHOLD_CHANGE,
    PERMISSIONS.PROPOSE_MEMBER_REMOVAL,
    PERMISSIONS.APPROVE_MEMBER_REMOVAL,
    PERMISSIONS.CREATE_REQUIREMENT,
    PERMISSIONS.VIEW_ARCHIVE,
  ],
  [RoleName.TREASURER]: [
    PERMISSIONS.APPROVE_REJECT_QUOTATION,
    PERMISSIONS.PROPOSE_THRESHOLD_CHANGE,
    PERMISSIONS.PROPOSE_MEMBER_REMOVAL,
    PERMISSIONS.APPROVE_MEMBER_REMOVAL,
    PERMISSIONS.CREATE_REQUIREMENT,
    PERMISSIONS.VIEW_ARCHIVE,
  ],
  [RoleName.OPS_VENDOR_QUEUE]: [
    PERMISSIONS.VENDOR_QUEUE_ACCESS,
    PERMISSIONS.VENDOR_DIRECTORY_ACCESS,
  ],
  [RoleName.OPS_SOCIETY_QUEUE]: [
    PERMISSIONS.SOCIETY_QUEUE_ACCESS,
    PERMISSIONS.SOCIETY_DIRECTORY_ACCESS,
  ],
  [RoleName.SUPER_ADMIN]: [
    PERMISSIONS.VENDOR_QUEUE_ACCESS,
    PERMISSIONS.SOCIETY_QUEUE_ACCESS,
    PERMISSIONS.VENDOR_DIRECTORY_ACCESS,
    PERMISSIONS.SOCIETY_DIRECTORY_ACCESS,
    PERMISSIONS.TAXONOMY_MANAGEMENT,
    PERMISSIONS.CITY_MANAGEMENT,
  ],
};

/**
 * The one check every API route and every gated UI component calls, with the
 * same permission string on both sides. Never gate an action in the frontend
 * only — see unified-platform-architecture.md Section 8.
 */
export function hasPermission(
  assignment: Pick<RoleAssignment, "status" | "permissions">,
  permission: Permission,
): boolean {
  return assignment.status === "ACTIVE" && assignment.permissions.includes(permission);
}
