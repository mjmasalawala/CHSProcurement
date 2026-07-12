import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  notifyDeadlineApproaching,
  notifyBidsReadyForReview,
  notifyBidDeadlineReminder,
} from "@/lib/notifications";

/**
 * Two time-based trigger events that can't fire from a user action
 * (society-portal-spec.md / vendor-registration-portal-spec.md Section 9):
 * "bid deadline approaching" (to the Manager, 24h before close) and "bid
 * deadline reminder" (to vendors who haven't bid yet), plus "bids ready for
 * review" once the deadline has passed. Scheduled hourly via vercel.json.
 * Each requirement gets each notification exactly once, tracked by
 * deadlineReminderSentAt / deadlineClosedNotifiedAt.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const approaching = await prisma.requirement.findMany({
    where: {
      status: "OPEN",
      bidDeadline: { gt: now, lte: in24h },
      deadlineReminderSentAt: null,
    },
    include: {
      society: true,
      invites: { include: { vendorCompany: true } },
      bids: { select: { vendorCompanyId: true } },
    },
  });

  for (const requirement of approaching) {
    const managers = await prisma.roleAssignment.findMany({
      where: { entityType: "SOCIETY", entityId: requirement.societyId, role: "MANAGER", status: "ACTIVE" },
      include: { user: true },
    });
    const alreadyBid = new Set(requirement.bids.map((b) => b.vendorCompanyId));
    const pendingVendors = requirement.invites
      .map((i) => i.vendorCompany)
      .filter((v) => !alreadyBid.has(v.id));

    await Promise.all([
      managers.length > 0
        ? notifyDeadlineApproaching({
            managerEmails: managers.map((m) => m.user.email),
            societyName: requirement.society.name,
            requirementDescription: requirement.description,
            reviewUrl: `${base}/society/${requirement.societyId}/requirements/${requirement.id}`,
          })
        : Promise.resolve(),
      ...pendingVendors.map((v) =>
        notifyBidDeadlineReminder({
          vendorEmail: v.ownerEmail,
          vendorPhone: v.ownerPhone,
          requirementDescription: requirement.description,
          reviewUrl: `${base}/vendor/${v.id}/requirements/${requirement.id}`,
        }),
      ),
    ]);

    await prisma.requirement.update({
      where: { id: requirement.id },
      data: { deadlineReminderSentAt: now },
    });
  }

  const closed = await prisma.requirement.findMany({
    where: {
      status: "OPEN",
      bidDeadline: { lte: now },
      deadlineClosedNotifiedAt: null,
    },
    include: { society: true },
  });

  for (const requirement of closed) {
    const managers = await prisma.roleAssignment.findMany({
      where: { entityType: "SOCIETY", entityId: requirement.societyId, role: "MANAGER", status: "ACTIVE" },
      include: { user: true },
    });

    if (managers.length > 0) {
      await notifyBidsReadyForReview({
        managerEmails: managers.map((m) => m.user.email),
        societyName: requirement.society.name,
        requirementDescription: requirement.description,
        reviewUrl: `${base}/society/${requirement.societyId}/requirements/${requirement.id}`,
      });
    }

    await prisma.requirement.update({
      where: { id: requirement.id },
      data: { deadlineClosedNotifiedAt: now },
    });
  }

  return NextResponse.json({
    approachingNotified: approaching.length,
    closedNotified: closed.length,
  });
}
