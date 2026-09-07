import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { IMPERSONATION_COOKIE, loadActiveImpersonation } from "@/lib/impersonation";

/**
 * No database adapter on purpose: our schema is User + RoleAssignment (per
 * unified-platform-architecture.md Section 3), not Auth.js's own
 * Account/Session/VerificationToken tables. JWT session strategy handles both
 * Google and Credentials sign-in without them — see callbacks below.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        // Real access gate, not just a UI nicety — an account created by a
        // flow that requires WhatsApp OTP verification (register/vendor)
        // stays unable to log in until that verification actually
        // completes, even though the password itself was already set
        // earlier in that same flow. login/actions.ts checks this first to
        // route an unverified-but-correct-password attempt into the OTP
        // screen instead of a bare "incorrect credentials" error; this is
        // the enforcement that can't be bypassed by skipping that page.
        if (user.phoneVerificationRequired && !user.phoneVerifiedAt) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Google sign-in has no adapter to persist the User row — do it here,
      // find-or-create by email. Credentials sign-in already resolved a real
      // User in authorize() above, including its own
      // phoneVerificationRequired check — but that check lives inside the
      // Credentials provider only, so on its own it did nothing to stop
      // someone abandoning register/vendor's OTP step and then hitting
      // "Continue with Google" with the same email: Google sign-in matches
      // the existing User by email and, without this check, would have
      // signed them straight in. Checking it here instead — after the
      // upsert, so it applies to the same User row a Credentials sign-in
      // would have matched — covers every provider in one place.
      if (account?.provider === "google" && user.email) {
        const dbUser = await prisma.user.upsert({
          where: { email: user.email },
          update: { name: user.name ?? undefined },
          create: { email: user.email, name: user.name },
        });
        if (dbUser.phoneVerificationRequired && !dbUser.phoneVerifiedAt) {
          // Google carries no password through to complete the OTP flow
          // (verifyVendorRegistrationPhone/verifyLoginPhone both need one
          // to finish signIn("credentials", ...)), so there's no
          // equivalent "detour into an OTP screen" available here — send
          // them to log in with email+password instead, which does have
          // that path.
          return "/login?error=verify_with_password";
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      const email = user?.email ?? token.email;
      if (!email) return token;

      // Re-fetched on every sign-in (user is only set then); the JWT then
      // carries this snapshot until next login. RoleAssignment changes
      // in between won't be reflected mid-session for v1 — acceptable
      // trade-off for MVP, revisit if this needs to be live.
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { email },
          include: { roleAssignments: { where: { status: "ACTIVE" } } },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.roleAssignments = dbUser.roleAssignments.map((ra) => ({
            id: ra.id,
            entityType: ra.entityType,
            entityId: ra.entityId,
            role: ra.role,
            permissions: ra.permissions,
          }));
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      session.user.roleAssignments = token.roleAssignments ?? [];

      // Overlay an active impersonation on top of the real session, without
      // ever touching the JWT itself — see src/lib/impersonation.ts. The
      // cookie only carries an opaque pointer; the ImpersonationEvent row in
      // the DB is what's actually authoritative (and instantly revocable).
      const impersonationToken = (await cookies()).get(IMPERSONATION_COOKIE)?.value;
      if (impersonationToken) {
        const event = await loadActiveImpersonation(impersonationToken);
        if (event) {
          session.user.id = event.targetUser.id;
          session.user.email = event.targetUser.email;
          session.user.name = event.targetUser.name;
          session.user.roleAssignments = event.targetUser.roleAssignments.map((ra) => ({
            id: ra.id,
            entityType: ra.entityType,
            entityId: ra.entityId,
            role: ra.role,
            permissions: ra.permissions,
          }));
          session.impersonation = {
            eventId: event.id,
            reason: event.reason,
            startedAt: event.startedAt.toISOString(),
            adminUserId: event.adminUserId,
            adminName: event.adminUser.name,
            adminEmail: event.adminUser.email,
          };
        }
      }

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
