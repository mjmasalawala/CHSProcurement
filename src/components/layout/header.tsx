import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { endImpersonation } from "@/app/admin/support/actions";
import { isStagingEnvironment } from "@/lib/environment";

/**
 * Global app chrome (root layout) — one header for every route, logged-in or
 * not, instead of each page building its own. Logged out: logo + Login.
 * Logged in: logo (→ /app), identity, a Switch workspace link when the
 * session holds more than one Role Assignment, and Sign out. The Support
 * tool itself lives in the admin sidebar (/admin/support — see
 * src/app/admin/layout.tsx), not here. While impersonating, a persistent
 * banner replaces the identity block — see src/lib/impersonation.ts. A
 * staging banner (2026-09-05) sits above everything else, on-brand-orange
 * and unmissable, only rendered on the develop-branch deployment.
 */
export async function Header() {
  const session = await auth();

  return (
    <>
      {isStagingEnvironment() && (
        // Deliberately not sticky (unlike the header below it) — it scrolls
        // away with the page instead of fighting the header for the top-0
        // sticky slot, which would need a hardcoded height offset to stack
        // correctly. The header staying pinned on its own is enough; this
        // only needs to be seen once per page load, not permanently docked.
        <div className="bg-status-warning px-6 py-1.5 text-center text-[12px] font-semibold uppercase tracking-wide text-white">
          Staging environment — not production
        </div>
      )}

      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle bg-background-primary/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background-primary/80">
        <Link href={session ? "/app" : "/"} className="flex items-center">
          <img src="/logo-full.png" alt="Wisesoc" className="h-10 w-auto" />
        </Link>

        {session ? (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="hidden text-[13px] font-semibold text-text-primary sm:block">
                {session.user.name ?? session.user.email}
              </p>
              {session.user.roleAssignments.length > 1 && (
                <Link href="/app" className="text-[13px] font-medium text-accent-primary hover:underline">
                  Switch workspace
                </Link>
              )}
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="ghost" className="px-3 py-1.5 text-[13px]">
                Sign out
              </Button>
            </form>
          </div>
        ) : (
          <Link href="/login">
            <Button variant="ghost">Login</Button>
          </Link>
        )}
      </header>

      {session?.impersonation && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-status-warning/15 px-6 py-2 text-[13px] text-text-primary">
          <p>
            <span className="font-semibold">{session.impersonation.adminEmail}</span> is viewing as{" "}
            <span className="font-semibold">{session.user.name ?? session.user.email}</span> —{" "}
            {session.impersonation.reason}
          </p>
          <form action={endImpersonation}>
            <Button type="submit" variant="ghost" className="px-3 py-1 text-[13px]">
              End impersonation
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
