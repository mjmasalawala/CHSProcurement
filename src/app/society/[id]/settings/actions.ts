"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyActionPermission } from "@/lib/society-auth";
import { notifyThresholdChangeProposed, notifyThresholdChangeDecided } from "@/lib/notifications";
import { OB_ROLES, MIN_ACTIVE_OFFICE_BEARERS, countActiveOfficeBearers } from "@/lib/society-ob";
import { revalidatePath } from "next/cache";

/**
 * Generic co-approval mechanism (society-portal-spec.md Section 7.1),
 * applied here to approvalThreshold — one proposer (Secretary/Treasurer),
 * one different Office Bearer's approval.
 */
export async function proposeThresholdChange(
  societyId: string,
  newValue: string,
): Promise<{ error: string } | undefined> {
  await requireSocietyActionPermission(societyId, PERMISSIONS.PROPOSE_THRESHOLD_CHANGE);
  const session = await auth();
  if (!session) return { error: "Not authorized." };

  const obCount = await countActiveOfficeBearers(societyId);
  if (obCount < MIN_ACTIVE_OFFICE_BEARERS) {
    return {
      error: `This society needs at least ${MIN_ACTIVE_OFFICE_BEARERS} active Office Bearers before a threshold change can be proposed — nobody else would be able to approve it.`,
    };
  }

  const parsed = Number(newValue);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    return { error: "Enter a whole number greater than 0." };
  }

  const existing = await prisma.proposedChange.findFirst({
    where: { societyId, field: "approvalThreshold", status: "PENDING" },
  });
  if (existing) return { error: "There's already a pending threshold change proposal." };

  const society = await prisma.society.findUniqueOrThrow({ where: { id: societyId } });

  await prisma.proposedChange.create({
    data: {
      societyId,
      field: "approvalThreshold",
      oldValue: String(society.approvalThreshold),
      newValue: String(parsed),
      proposedByUserId: session.user.id,
    },
  });

  const obs = await prisma.roleAssignment.findMany({
    where: {
      entityType: "SOCIETY",
      entityId: societyId,
      role: { in: [...OB_ROLES] },
      status: "ACTIVE",
      userId: { not: session.user.id },
    },
    include: { user: true },
  });
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await notifyThresholdChangeProposed({
    recipients: obs.map((ra) => ra.user.email),
    societyName: society.name,
    oldValue: String(society.approvalThreshold),
    newValue: String(parsed),
    proposerName: session.user.name ?? session.user.email ?? "An Office Bearer",
    reviewUrl: `${base}/society/${societyId}/settings`,
  });

  revalidatePath(`/society/${societyId}/settings`);
}

export async function decideThresholdChange(
  societyId: string,
  proposedChangeId: string,
  decision: "APPROVED" | "REJECTED",
): Promise<{ error: string } | undefined> {
  await requireSocietyActionPermission(societyId, PERMISSIONS.APPROVE_REJECT_QUOTATION);
  const session = await auth();
  if (!session) return { error: "Not authorized." };

  const change = await prisma.proposedChange.findUnique({ where: { id: proposedChangeId } });
  if (!change || change.societyId !== societyId || change.status !== "PENDING") {
    return { error: "This proposal is no longer pending." };
  }
  if (change.proposedByUserId === session.user.id) {
    return { error: "You can't approve your own proposal — it needs a different Office Bearer." };
  }

  await prisma.$transaction([
    prisma.proposedChange.update({
      where: { id: proposedChangeId },
      data: { status: decision, approvedByUserId: session.user.id, decidedAt: new Date() },
    }),
    ...(decision === "APPROVED"
      ? [
          prisma.society.update({
            where: { id: societyId },
            data: { approvalThreshold: Number(change.newValue) },
          }),
        ]
      : []),
  ]);

  const proposer = await prisma.user.findUniqueOrThrow({ where: { id: change.proposedByUserId } });
  const society = await prisma.society.findUniqueOrThrow({ where: { id: societyId } });
  await notifyThresholdChangeDecided({
    proposerEmail: proposer.email,
    societyName: society.name,
    oldValue: change.oldValue,
    newValue: change.newValue,
    approved: decision === "APPROVED",
    deciderName: session.user.name ?? session.user.email ?? "an Office Bearer",
  });

  revalidatePath(`/society/${societyId}/settings`);
}
