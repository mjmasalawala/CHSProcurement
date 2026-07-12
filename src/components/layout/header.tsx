import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

/**
 * Global app chrome (root layout) — one header for every route, logged-in or
 * not, instead of each page building its own. Logged out: logo + Login.
 * Logged in: logo (→ /app), identity, a Switch workspace link when the
 * session holds more than one Role Assignment, and Sign out.
 */
export async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle bg-background-primary/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background-primary/80">
      <Link href={session ? "/app" : "/"} className="text-[18px] font-bold tracking-tight text-text-primary">
        ProSoc
      </Link>

      {session ? (
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-[13px] font-semibold text-text-primary">
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
  );
}
