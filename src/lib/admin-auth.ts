import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Session } from "@auth/core/types";
import type { Permission } from "@/lib/permissions";

type AdminSession = Session;

/** Server-component gate: redirects to login (preserving the return path) or /app. */
export async function requirePagePermission(
  permission: Permission,
  pathname: string,
): Promise<AdminSession> {
  const session = await auth();
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(pathname)}`);

  const allowed = session.user.roleAssignments.some((ra) => ra.permissions.includes(permission));
  if (!allowed) redirect("/app");

  return session;
}

/** Server-action gate: throws rather than redirecting. */
export async function requireActionPermission(permission: Permission): Promise<void> {
  const session = await auth();
  const allowed = session?.user.roleAssignments.some((ra) => ra.permissions.includes(permission));
  if (!allowed) throw new Error("Not authorized.");
}
