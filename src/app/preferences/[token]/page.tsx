import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getPreferenceByToken } from "@/lib/messaging/preferences";
import { updateMarketingSubscription } from "./actions";

// Public, unauthenticated (unsubscribe links must work without a login) —
// see Requirements/messaging-and-engagement-spec.md, "unsubscribe page".
// No marketing email exists yet in Phase 0 to link one of these tokens from
// — this only handles what exists today (the single subscribedMarketing
// toggle). WhatsApp opt-in/out and per-category toggles land alongside
// Phase 1/2's WhatsApp and campaign work.
export default async function PreferencesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const pref = await getPreferenceByToken(token);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-[28px] font-bold tracking-tight text-text-primary">Email preferences</h1>

        {!pref ? (
          <p className="text-[15px] text-text-secondary">This preferences link is invalid.</p>
        ) : (
          <>
            <p className="mb-6 text-[13px] text-text-secondary">{pref.email ?? pref.phone}</p>
            <p className="mb-4 text-[15px] text-text-primary">
              You are currently{" "}
              <strong>{pref.subscribedMarketing ? "subscribed to" : "unsubscribed from"}</strong> product updates,
              training material, and other non-essential Wisesoc emails. You&apos;ll always receive emails tied to
              your own account activity (approvals, deadlines, invites) regardless of this setting.
            </p>
            <form
              action={async () => {
                "use server";
                await updateMarketingSubscription(token, !pref.subscribedMarketing);
              }}
            >
              <Button type="submit" variant={pref.subscribedMarketing ? "secondary" : "primary"}>
                {pref.subscribedMarketing ? "Unsubscribe" : "Resubscribe"}
              </Button>
            </form>
          </>
        )}
      </Card>
    </main>
  );
}
