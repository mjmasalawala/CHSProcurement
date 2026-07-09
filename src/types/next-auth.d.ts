import type { DefaultSession } from "next-auth";
import type { EntityType, RoleName } from "@/generated/prisma/enums";

export interface SessionRoleAssignment {
  id: string;
  entityType: EntityType;
  entityId: string | null;
  role: RoleName;
  permissions: string[];
}

declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
      roleAssignments: SessionRoleAssignment[];
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    roleAssignments?: SessionRoleAssignment[];
  }
}
