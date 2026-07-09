import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

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

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Google sign-in has no adapter to persist the User row — do it here,
      // find-or-create by email. Credentials sign-in already resolved a real
      // User in authorize() above.
      if (account?.provider === "google" && user.email) {
        await prisma.user.upsert({
          where: { email: user.email },
          update: { name: user.name ?? undefined },
          create: { email: user.email, name: user.name },
        });
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
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
