import type { BadgeTone } from "@/components/ui/badge";

/**
 * Maps every status/decision enum value used across the app (EntityStatus,
 * RoleAssignmentStatus, RequirementStatus, BidStatus, ProposedChangeStatus,
 * ApprovalDecision, CategoryRequestStatus) to a Badge tone. One shared map
 * so a given word always reads the same color everywhere it shows up.
 */
const TONE_BY_STATUS: Record<string, BadgeTone> = {
  ACTIVE: "success",
  APPROVED: "success",
  WON: "success",
  FINALIZED: "success",

  PENDING: "warning",
  PENDING_VERIFICATION: "warning",
  AWAITING_APPROVAL: "warning",
  RETURNED_TO_MANAGER: "warning",

  REJECTED: "error",

  SUBMITTED: "info",
  OPEN: "info",

  DEACTIVATED: "neutral",
  NOT_SELECTED: "neutral",
};

export function statusTone(status: string): BadgeTone {
  return TONE_BY_STATUS[status] ?? "neutral";
}

export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
