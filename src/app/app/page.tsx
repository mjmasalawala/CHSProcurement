import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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

      {roleAssignments.length === 0 && (
        <Card>
          <p className="text-[15px] text-text-primary">
            No active role assignments yet.
          </p>
          <p className="mt-1 text-[13px] text-text-secondary">
            You&apos;ll land here once a Society/Vendor registration is approved or
            you accept an invite (M2/M3).
          </p>
        </Card>
      )}

      {roleAssignments.length === 1 && (
        <Card>
          <p className="mb-1 text-[13px] text-text-secondary">Routed straight into</p>
          <p className="text-[18px] font-semibold text-text-primary">
            {roleAssignments[0].role} — {roleAssignments[0].entityType}
            {roleAssignments[0].entityId ? ` (${roleAssignments[0].entityId})` : ""}
          </p>
        </Card>
      )}

      {roleAssignments.length > 1 && (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-text-secondary">Select a context</p>
          {roleAssignments.map((ra) => (
            <Card key={ra.id} className="flex items-center justify-between">
              <div>
                <p className="text-[15px] font-medium text-text-primary">{ra.role}</p>
                <p className="text-[13px] text-text-secondary">
                  {ra.entityType}
                  {ra.entityId ? ` (${ra.entityId})` : ""}
                </p>
              </div>
              <Button variant="secondary">Switch</Button>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
