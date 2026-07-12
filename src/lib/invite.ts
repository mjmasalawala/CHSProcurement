import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { EntityType, RoleName } from "@/generated/prisma/enums";
import { ROLE_DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { getEntityName } from "@/lib/entities";
import { sendInvite } from "@/lib/notifications";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generic invite-acceptance mechanism (landing-page-and-auth-flow-spec.md
 * Section 4) — one function, parameterized by role/entity, reused for every
 * invite type (Secretary activation, Manager/Chairman/Treasurer invited by
 * Secretary, Vendor Staff invited by Owner). Creates a PENDING RoleAssignment
 * plus a single-use token; the invitee flips it to ACTIVE by visiting
 * /invite/[token]. Emails the link to the invitee before returning, so no
 * caller needs to remember to wire that up separately.
 */
export async function createInvite(params: {
  email: string;
  entityType: EntityType;
  entityId: string | null;
  role: RoleName;
}): Promise<{ token: string; url: string }> {
  const user = await prisma.user.upsert({
    where: { email: params.email },
    update: {},
    create: { email: params.email },
  });

  const roleAssignment = await prisma.roleAssignment.create({
    data: {
      userId: user.id,
      entityType: params.entityType,
      entityId: params.entityId,
      role: params.role,
      permissions: ROLE_DEFAULT_PERMISSIONS[params.role],
      status: "PENDING",
    },
  });

  const token = randomBytes(32).toString("base64url");
  await prisma.invite.create({
    data: {
      token,
      email: params.email,
      roleAssignmentId: roleAssignment.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const url = `${base}/invite/${token}`;

  const entityName = await getEntityName(params.entityType, params.entityId);
  await sendInvite({ email: params.email, role: params.role, entityName, url });

  return { token, url };
}
