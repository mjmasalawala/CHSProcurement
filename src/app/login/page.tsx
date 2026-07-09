import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithCredentials, signInWithGoogle } from "./actions";

/**
 * Functional stand-in for M1 (proves the auth flow end-to-end). The real
 * landing/login page styling per landing-page-and-auth-flow-spec.md ships
 * in M2.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-[24px] font-bold text-text-primary">Log in</h1>
        <p className="mb-6 text-[13px] text-text-secondary">Bluejay platform login</p>

        {error && (
          <p className="mb-4 text-[13px] text-status-error">
            Incorrect email or password.
          </p>
        )}

        <form action={signInWithGoogle} className="mb-4">
          <Button type="submit" variant="secondary" className="w-full">
            Continue with Google
          </Button>
        </form>

        <div className="mb-4 flex items-center gap-3 text-[13px] text-text-secondary">
          <div className="h-px flex-1 bg-border-subtle" />
          or
          <div className="h-px flex-1 bg-border-subtle" />
        </div>

        <form action={signInWithCredentials} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <Button type="submit" className="w-full">
            Log in
          </Button>
        </form>
      </Card>
    </main>
  );
}
