// Plain constants/types shared by the wizard (client) and actions.ts (server
// action module) — kept out of actions.ts because a "use server" file may
// only export async functions; any other export (consts, types) is silently
// dropped from the client bundle, breaking client-side imports of it.

// Who can submit the registration form. Ops-only roles are never a valid
// registrant — this is a plain society sign-up, not a platform action.
export const REGISTRANT_ROLES = ["MANAGER", "CHAIRMAN", "SECRETARY", "TREASURER", "GB_MEMBER"] as const;
export type RegistrantRole = (typeof REGISTRANT_ROLES)[number];

// Who can actually be invited to activate the account. GB Member holds no
// permissions (permissions.ts) and never gets a login, so a GB Member
// registrant must name one of these to run things instead.
export const INVITEE_ROLES = ["MANAGER", "CHAIRMAN", "SECRETARY", "TREASURER"] as const;
export type InviteeRole = (typeof INVITEE_ROLES)[number];

export interface SocietyRegistrationInput {
  name: string;
  address: string;
  cityId: string;
  unitsCount: string;
  registrationNumber: string;
  registrantRole: RegistrantRole | "";
  registrantName: string;
  registrantPhone: string;
  registrantEmail: string;
  // Always required (captured for the record even if the Secretary isn't the
  // one activating the account) — auto-filled from registrant details when
  // registrantRole is SECRETARY.
  secretaryName: string;
  secretaryPhone: string;
  secretaryEmail: string;
  // Required only when registrantRole is GB_MEMBER — who the activation
  // invite should actually go to.
  inviteeRole: InviteeRole | "";
  inviteeName: string;
  inviteePhone: string;
  inviteeEmail: string;
}
