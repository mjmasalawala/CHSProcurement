"use server";

import { prisma } from "@/lib/prisma";
import { notifyNewRegistration } from "@/lib/email";

export interface SocietyRegistrationInput {
  name: string;
  address: string;
  cityId: string;
  unitsCount: string;
  registrationNumber: string;
  secretaryName: string;
  secretaryPhone: string;
  secretaryEmail: string;
}

/**
 * No account is created here — the Secretary only gets an activation invite
 * once ProSoc Ops approves this registration, per
 * landing-page-and-auth-flow-spec.md Section 1/3. The person filling out this
 * form is assumed to be the Secretary (or filing on their behalf), so the
 * "registrant" fields are just the Secretary's own details — they invite the
 * Manager and other Office Bearers themselves after activation.
 */
export async function registerSociety(
  input: SocietyRegistrationInput,
): Promise<{ error: string } | { ok: true }> {
  if (!input.cityId) return { error: "Select a city." };

  const society = await prisma.society.create({
    data: {
      name: input.name,
      address: input.address,
      cityId: input.cityId,
      unitsCount: Number(input.unitsCount),
      registrationNumber: input.registrationNumber || null,
      registrantName: input.secretaryName,
      registrantRole: "SECRETARY",
      registrantPhone: input.secretaryPhone,
      registrantEmail: input.secretaryEmail,
      secretaryName: input.secretaryName,
      secretaryPhone: input.secretaryPhone,
      secretaryEmail: input.secretaryEmail,
    },
  });

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await notifyNewRegistration({
    type: "Society",
    name: input.name,
    contactName: input.secretaryName,
    contactEmail: input.secretaryEmail,
    approveUrl: `${base}/admin/societies/${society.id}`,
  });

  return { ok: true };
}
