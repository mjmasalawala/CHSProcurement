import type { DefaultSession } from "next-auth";
import type { EntityType, RoleName } from "@/generated/prisma/enums";

export interface SessionRoleAssignment {
  id: string;
  entityType: EntityType;
  entityId: string | null;
  role: RoleName;
  permissions: string[];
}

export interface SessionImpersonation {
  eventId: string;
  reason: string;
  startedAt: string;
  adminUserId: string;
  adminName: string | null;
  adminEmail: string;
}

declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
      roleAssignments: SessionRoleAssignment[];
    } & DefaultSession["user"];
    // Present only while an admin/support user is impersonating — see
    // src/lib/impersonation.ts and auth.ts's session callback. When set,
    // session.user reflects the *target* user (id/roleAssignments/etc.),
    // and this field is the only place the real actor's identity survives.
    impersonation?: SessionImpersonation | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    roleAssignments?: SessionRoleAssignment[];
  }
}
