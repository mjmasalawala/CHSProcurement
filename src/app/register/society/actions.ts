"use server";

import { prisma } from "@/lib/prisma";
import type { RoleName } from "@/generated/prisma/enums";
import { notifyNewRegistration, notifyRegistrationSubmitted } from "@/lib/notifications";
import { REGISTRANT_ROLES, INVITEE_ROLES, type SocietyRegistrationInput } from "./data";

/**
 * No account is created here — the invitee (see below) only gets an
 * activation invite once ProSoc Ops approves this registration, per
 * landing-page-and-auth-flow-spec.md Section 1/3. Registration is no longer
 * assumed to be filed by the Secretary — any Manager, Office Bearer, or
 * General Body Member can submit it, naming who should actually run the
 * account (approveSociety in admin/societies/[id]/actions.ts resolves who
 * gets invited from registrantRole/registrantName vs. invitee*).
 */
export async function registerSociety(
  input: SocietyRegistrationInput,
): Promise<{ error: string } | { ok: true }> {
  if (!input.cityId) return { error: "Select a city." };
  if (!input.registrantRole || !REGISTRANT_ROLES.includes(input.registrantRole)) {
    return { error: "Select your role." };
  }

  const isSecretary = input.registrantRole === "SECRETARY";
  const isGbMember = input.registrantRole === "GB_MEMBER";

  if (isGbMember && (!input.inviteeRole || !INVITEE_ROLES.includes(input.inviteeRole))) {
    return { error: "Select who should manage the account." };
  }

  const secretaryName = isSecretary ? input.registrantName : input.secretaryName;
  const secretaryPhone = isSecretary ? input.registrantPhone : input.secretaryPhone;
  const secretaryEmail = isSecretary ? input.registrantEmail : input.secretaryEmail;

  const society = await prisma.society.create({
    data: {
      name: input.name,
      address: input.address,
      cityId: input.cityId,
      unitsCount: Number(input.unitsCount),
      registrationNumber: input.registrationNumber || null,
      registrantName: input.registrantName,
      registrantRole: input.registrantRole as RoleName,
      registrantPhone: input.registrantPhone,
      registrantEmail: input.registrantEmail,
      secretaryName,
      secretaryPhone,
      secretaryEmail,
      inviteeRole: isGbMember ? (input.inviteeRole as RoleName) : null,
      inviteeName: isGbMember ? input.inviteeName : null,
      inviteePhone: isGbMember ? input.inviteePhone : null,
      inviteeEmail: isGbMember ? input.inviteeEmail : null,
    },
  });

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await Promise.all([
    notifyNewRegistration({
      type: "Society",
      name: input.name,
      contactName: input.registrantName,
      contactEmail: input.registrantEmail,
      approveUrl: `${base}/admin/societies/${society.id}`,
    }),
    notifyRegistrationSubmitted({
      type: "Society",
      name: input.name,
      contactEmail: input.registrantEmail,
      contactPhone: input.registrantPhone,
    }),
  ]);

  return { ok: true };
}
