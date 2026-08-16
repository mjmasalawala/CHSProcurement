"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import {
  IMPERSONATION_COOKIE,
  createImpersonationEvent,
  endImpersonationEvent,
  isProtectedFromImpersonation,
  resolveImpersonationTarget,
} from "@/lib/impersonation";

const COOKIE_MAX_AGE_SECONDS = 30 * 60;
const SEARCH_RESULT_LIMIT = 8;
const SEARCH_MIN_QUERY_LENGTH = 2;

/**
 * Live search behind the /admin/support dropdown — deliberately never ships
 * the full user list to the browser (that's every user's email, for a page
 * only a handful of support/admin accounts can even reach). Returns at most
 * a handful of matches per keystroke, already filtered to non-protected
 * users, same guard resolveImpersonationTarget re-checks at submit time.
 */
export async function searchImpersonationCandidates(
  query: string,
): Promise<{ id: string; label: string }[]> {
  const session = await auth();
  const allowed = session?.user.roleAssignments.some((ra) =>
    ra.permissions.includes(PERMISSIONS.IMPERSONATE_USER),
  );
  if (!session || !allowed) return [];

  const trimmed = query.trim();
  if (trimmed.length < SEARCH_MIN_QUERY_LENGTH) return [];

  const users = await prisma.user.findMany({
    where: {
      id: { not: session.user.id },
      OR: [
        { email: { contains: trimmed, mode: "insensitive" } },
        { name: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    select: { id: true, email: true, name: true, roleAssignments: { where: { status: "ACTIVE" } } },
    take: 20,
  });

  return users
    .filter((u) => !isProtectedFromImpersonation(u.roleAssignments))
    .slice(0, SEARCH_RESULT_LIMIT)
    .map((u) => ({ id: u.id, label: u.name ? `${u.name} (${u.email})` : u.email }));
}

export async function startImpersonation(
  _prevState: { error: string } | undefined,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const session = await auth();
  const allowed = session?.user.roleAssignments.some((ra) =>
    ra.permissions.includes(PERMISSIONS.IMPERSONATE_USER),
  );
  if (!session || !allowed) throw new Error("Not authorized.");

  const userId = String(formData.get("userId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId) return { error: "Select a user to impersonate." };
  if (!reason) return { error: "A reason is required." };
  if (userId === session.user.id) return { error: "You can't impersonate yourself." };

  const result = await resolveImpersonationTarget(userId);
  if ("error" in result) return result;

  const token = await createImpersonationEvent(session.user.id, result.userId, reason);
  (await cookies()).set(IMPERSONATION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });

  redirect("/app");
}

export async function endImpersonation(): Promise<void> {
  const store = await cookies();
  const token = store.get(IMPERSONATION_COOKIE)?.value;
  if (token) {
    await endImpersonationEvent(token);
    store.delete(IMPERSONATION_COOKIE);
  }
  redirect("/app");
}
