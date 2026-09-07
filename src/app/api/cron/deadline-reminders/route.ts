import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  notifyDeadlineApproaching,
  notifyBidsReadyForReview,
  notifyBidDeadlineReminder,
} from "@/lib/notifications";
import { getBaseUrl } from "@/lib/base-url";

/**
 * Two time-based trigger events that can't fire from a user action
 * (society-portal-spec.md / vendor-registration-portal-spec.md Section 9):
 * "bid deadline approaching" (to the Manager, 24h before close) and "bid
 * deadline reminder" (to vendors who haven't bid yet), plus "bids ready for
 * review" once the deadline has passed. Scheduled hourly via a GitHub
 * Actions workflow (.github/workflows/deadline-reminders.yml) rather than
 * Vercel's own crons — Vercel's Hobby plan only allows once-daily cron jobs.
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
  const base = getBaseUrl();

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

  let approachingFailed = 0;
  for (const requirement of approaching) {
    try {
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
              requirementName: requirement.name,
              reviewUrl: `${base}/society/${requirement.societyId}/requirements/${requirement.id}`,
            })
          : Promise.resolve(),
        ...pendingVendors.map((v) =>
          notifyBidDeadlineReminder({
            vendorEmail: v.ownerEmail,
            vendorPhone: v.ownerPhone,
            requirementName: requirement.name,
            reviewUrl: `${base}/vendor/${v.id}/requirements/${requirement.id}`,
          }),
        ),
      ]);

      await prisma.requirement.update({
        where: { id: requirement.id },
        data: { deadlineReminderSentAt: now },
      });
    } catch (err) {
      // A single bad recipient (e.g. a Resend rejection) must not crash the
      // whole hourly run — every other requirement in this batch still
      // needs its reminder sent. Left without deadlineReminderSentAt set,
      // so this one is retried next hour rather than silently dropped.
      approachingFailed++;
      console.error(`deadline-reminders: failed for requirement ${requirement.id}`, err);
    }
  }

  const closed = await prisma.requirement.findMany({
    where: {
      status: "OPEN",
      bidDeadline: { lte: now },
      deadlineClosedNotifiedAt: null,
    },
    include: { society: true },
  });

  let closedFailed = 0;
  for (const requirement of closed) {
    try {
      const managers = await prisma.roleAssignment.findMany({
        where: { entityType: "SOCIETY", entityId: requirement.societyId, role: "MANAGER", status: "ACTIVE" },
        include: { user: true },
      });

      if (managers.length > 0) {
        await notifyBidsReadyForReview({
          managerEmails: managers.map((m) => m.user.email),
          societyName: requirement.society.name,
          requirementName: requirement.name,
          reviewUrl: `${base}/society/${requirement.societyId}/requirements/${requirement.id}`,
        });
      }

      await prisma.requirement.update({
        where: { id: requirement.id },
        data: { deadlineClosedNotifiedAt: now },
      });
    } catch (err) {
      closedFailed++;
      console.error(`deadline-reminders: failed for requirement ${requirement.id}`, err);
    }
  }

  return NextResponse.json({
    approachingNotified: approaching.length - approachingFailed,
    approachingFailed,
    closedNotified: closed.length - closedFailed,
    closedFailed,
  });
}
