import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { RoleName } from "../src/generated/prisma/enums";
import { hashPassword } from "../src/lib/password";
import { ROLE_DEFAULT_PERMISSIONS } from "../src/lib/permissions";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Local/dev-only test users, standing in for the registration + invite flows
 * that ship in M2/M3. Covers the three post-login routing shapes from
 * unified-platform-architecture.md Section 5: single context (straight in),
 * multiple contexts (switcher), and a platform role.
 */
async function main() {
  const passwordHash = await hashPassword("password123");

  await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {},
    create: {
      email: "owner@example.com",
      name: "Vendor Owner (single context)",
      passwordHash,
      roleAssignments: {
        create: {
          entityType: "VENDOR_COMPANY",
          entityId: "seed-vendor-1",
          role: RoleName.VENDOR_OWNER,
          permissions: ROLE_DEFAULT_PERMISSIONS[RoleName.VENDOR_OWNER],
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: {},
    create: {
      email: "manager@example.com",
      name: "Manager (multi context)",
      passwordHash,
      roleAssignments: {
        create: [
          {
            entityType: "SOCIETY",
            entityId: "seed-society-1",
            role: RoleName.MANAGER,
            permissions: ROLE_DEFAULT_PERMISSIONS[RoleName.MANAGER],
          },
          {
            entityType: "SOCIETY",
            entityId: "seed-society-2",
            role: RoleName.MANAGER,
            permissions: ROLE_DEFAULT_PERMISSIONS[RoleName.MANAGER],
          },
        ],
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Bluejay Super Admin",
      passwordHash,
      roleAssignments: {
        create: {
          entityType: "PLATFORM",
          entityId: null,
          role: RoleName.SUPER_ADMIN,
          permissions: ROLE_DEFAULT_PERMISSIONS[RoleName.SUPER_ADMIN],
        },
      },
    },
  });

  console.log("Seeded: owner@example.com, manager@example.com, admin@example.com (password: password123)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
