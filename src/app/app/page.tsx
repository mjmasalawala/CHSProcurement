import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getEntityName } from "@/lib/entities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SessionRoleAssignment } from "@/types/next-auth";

/** Vendor (M4) and Society (M5) modules have real screens now. */
function workspaceHref(ra: SessionRoleAssignment): string | null {
  if (ra.entityType === "VENDOR_COMPANY" && ra.entityId) return `/vendor/${ra.entityId}`;
  if (ra.entityType === "SOCIETY" && ra.entityId) return `/society/${ra.entityId}`;
  return null;
}

/**
 * Post-login routing skeleton — unified-platform-architecture.md Section 5.
 * Single Role Assignment: route straight into that context (no module
 * screens exist yet, so we just say which one). Multiple: show a context
 * switcher. Real module rendering per context lands with M3/M4/M5.
 */
export default async function AppHome() {
  const session = await auth();
  if (!session) redirect("/login");

  const { roleAssignments, name, email } = session.user;
  const withNames = await Promise.all(
    roleAssignments.map(async (ra) => ({
      ...ra,
      entityName: await getEntityName(ra.entityType, ra.entityId),
    })),
  );

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-text-primary">
            {name ?? email}
          </h1>
          <p className="text-[13px] text-text-secondary">{email}</p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button type="submit" variant="ghost">
            Sign out
          </Button>
        </form>
      </div>

      {withNames.length === 0 && (
        <Card>
          <p className="text-[15px] text-text-primary">
            No active role assignments yet.
          </p>
          <p className="mt-1 text-[13px] text-text-secondary">
            You&apos;ll land here once a Society/Vendor registration is approved or
            you accept an invite (M3).
          </p>
        </Card>
      )}

      {withNames.length === 1 && (
        <Card>
          <p className="mb-1 text-[13px] text-text-secondary">Routed straight into</p>
          <p className="text-[18px] font-semibold text-text-primary">
            {withNames[0].role} — {withNames[0].entityName ?? withNames[0].entityType}
          </p>
          {workspaceHref(withNames[0]) && (
            <Link
              href={workspaceHref(withNames[0])!}
              className="mt-3 inline-block text-[13px] text-accent-primary underline"
            >
              Open workspace →
            </Link>
          )}
        </Card>
      )}

      {withNames.length > 1 && (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-text-secondary">Select a context</p>
          {withNames.map((ra) => {
            const href = workspaceHref(ra);
            return (
              <Card key={ra.id} className="flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-medium text-text-primary">{ra.role}</p>
                  <p className="text-[13px] text-text-secondary">
                    {ra.entityName ?? ra.entityType}
                  </p>
                </div>
                {href ? (
                  <Link
                    href={href}
                    className="rounded-md border border-border-subtle bg-background-secondary px-4 py-2 text-[15px] font-semibold text-text-primary hover:bg-white"
                  >
                    Switch
                  </Link>
                ) : (
                  <Button variant="secondary" disabled>
                    Switch
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
