import { NextRequest, NextResponse } from "next/server";
import { sweep } from "@/lib/messaging/dispatcher";

/**
 * The outbox sweeper (Requirements/messaging-and-engagement-spec.md, "two
 * entry points into the same send logic"). Picks up anything QUEUED and
 * due — today, that's just automatic retries of a row an immediate sendOne
 * call already tried once and failed; Phase 2 adds reminders/sequences/
 * campaigns here. Triggered every few minutes by GitHub Actions (see
 * .github/workflows/dispatch-messages.yml), same CRON_SECRET pattern as
 * /api/cron/deadline-reminders.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await sweep();
  return NextResponse.json(result);
}
