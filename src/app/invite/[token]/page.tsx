import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEntityName } from "@/lib/entities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  acceptInviteExistingUser,
  acceptInviteForCurrentSession,
  acceptInviteNewUser,
} from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "This invite link is invalid or has already been used.",
  weak_password: "Password must be at least 8 characters.",
  invalid_password: "Incorrect password.",
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { roleAssignment: { include: { user: true } } },
  });

  if (!invite || invite.expiresAt < new Date()) {
    return (
      <Main>
        <Card className="w-full max-w-sm">
          <p className="text-[15px] text-text-primary">
            This invite link is invalid or has expired.
          </p>
          <p className="mt-1 text-[13px] text-text-secondary">
            Ask whoever invited you to send a new one.
          </p>
        </Card>
      </Main>
    );
  }

  if (invite.acceptedAt) {
    return (
      <Main>
        <Card className="w-full max-w-sm">
          <p className="text-[15px] text-text-primary">This invite has already been accepted.</p>
          <a href="/login" className="mt-2 inline-block text-[13px] text-accent-primary">
            Log in
          </a>
        </Card>
      </Main>
    );
  }

  const { roleAssignment } = invite;
  const entityName = await getEntityName(roleAssignment.entityType, roleAssignment.entityId);
  const hasPassword = !!roleAssignment.user.passwordHash;

  const session = await auth();
  const isCurrentUser = session?.user.email === invite.email;

  const acceptForCurrentSession = acceptInviteForCurrentSession.bind(null, token);
  const acceptNewUser = acceptInviteNewUser.bind(null, token);
  const acceptExistingUser = acceptInviteExistingUser.bind(null, token);

  return (
    <Main>
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-[18px] font-semibold text-text-primary">
          You&apos;ve been invited as {roleAssignment.role}
          {entityName ? ` for ${entityName}` : ""}
        </h1>
        <p className="mb-6 text-[13px] text-text-secondary">{invite.email}</p>

        {error && (
          <p className="mb-4 text-[13px] text-status-error">
            {ERROR_MESSAGES[error] ?? "Something went wrong."}
          </p>
        )}

        {isCurrentUser ? (
          <form action={acceptForCurrentSession}>
            <Button type="submit" className="w-full">
              Accept invite
            </Button>
            <p className="mt-2 text-[13px] text-text-secondary">
              You&apos;ll be asked to log back in to pick up the new access.
            </p>
          </form>
        ) : hasPassword ? (
          <form action={acceptExistingUser} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button type="submit" className="w-full">
              Log in &amp; accept
            </Button>
          </form>
        ) : (
          <form action={acceptNewUser} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="password">Set a password</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            <Button type="submit" className="w-full">
              Set password &amp; accept
            </Button>
          </form>
        )}
      </Card>
    </Main>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">{children}</main>
  );
}
