"use server";

import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireActionPermission } from "@/lib/admin-auth";
import { createInvite } from "@/lib/invite";
import { notifyRejection, notifySocietyRegistrationApprovedToRegistrant } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

const ROLE_LABELS: Record<string, string> = {
  MANAGER: "Manager",
  CHAIRMAN: "Chairman",
  SECRETARY: "Secretary",
  TREASURER: "Treasurer",
  GB_MEMBER: "General Body Member",
};

export async function approveSociety(societyId: string): Promise<{ inviteUrl: string }> {
  await requireActionPermission(PERMISSIONS.SOCIETY_QUEUE_ACCESS);

  const society = await prisma.society.update({
    where: { id: societyId },
    data: { status: "ACTIVE", approvedAt: new Date() },
  });

  // The activation invite goes to whoever was named to manage the account —
  // the separately-captured invitee (a GB Member registrant always names
  // one), or the registrant themselves when they're already a
  // Manager/Chairman/Secretary/Treasurer (register/society/actions.ts).
  const inviteeRole = society.inviteeRole ?? society.registrantRole;
  const inviteeName = society.inviteeName ?? society.registrantName;
  const inviteeEmail = society.inviteeEmail ?? society.registrantEmail;

  if (inviteeRole === "GB_MEMBER") {
    throw new Error(`Society ${society.id} has no invitee on file for its GB Member registrant — cannot activate.`);
  }

  const { url } = await createInvite({
    email: inviteeEmail,
    entityType: "SOCIETY",
    entityId: society.id,
    role: inviteeRole,
    registrationPitch: {
      proposerName: society.registrantName,
      proposerRoleLabel: ROLE_LABELS[society.registrantRole] ?? society.registrantRole,
      societyName: society.name,
    },
  });

  if (inviteeEmail !== society.registrantEmail) {
    try {
      await notifySocietyRegistrationApprovedToRegistrant({
        registrantEmail: society.registrantEmail,
        registrantName: society.registrantName,
        societyName: society.name,
        inviteeName,
        inviteeRoleLabel: ROLE_LABELS[inviteeRole] ?? inviteeRole,
        inviteeEmail,
      });
    } catch (err) {
      console.error("Failed to notify registrant that the invite was sent to the account manager:", err);
    }
  }

  revalidatePath(`/admin/societies/${societyId}`);
  revalidatePath("/admin/societies");
  return { inviteUrl: url };
}

export async function rejectSociety(societyId: string, reason: string): Promise<void> {
  await requireActionPermission(PERMISSIONS.SOCIETY_QUEUE_ACCESS);

  const society = await prisma.society.update({
    where: { id: societyId },
    data: { status: "REJECTED", rejectionReason: reason || null },
  });

  try {
    await notifyRejection({
      type: "Society",
      name: society.name,
      contactEmail: society.registrantEmail,
      contactPhone: society.registrantPhone,
      reason,
    });
  } catch (err) {
    console.error("Failed to notify society of rejection:", err);
  }

  revalidatePath(`/admin/societies/${societyId}`);
  revalidatePath("/admin/societies");
}
