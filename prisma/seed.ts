import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { RoleName } from "../src/generated/prisma/enums";
import { hashPassword } from "../src/lib/password";
import { ROLE_DEFAULT_PERMISSIONS } from "../src/lib/permissions";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// vendor-registration-portal-spec.md Section 5 — example starter list, final
// list confirmed via Admin taxonomy management (M3).
const CATEGORIES = [
  "Plumbing",
  "Electrical",
  "Painting",
  "Civil/Masonry",
  "Waterproofing",
  "Lift/Elevator AMC",
  "Pest Control",
  "Housekeeping",
  "Landscaping",
  "Fire Safety",
  "Security Systems",
];

// Placeholder pilot cities — swap for real ones via Admin city management
// (M3) once confirmed.
const CITIES = ["Mumbai", "Pune", "Bengaluru", "Delhi NCR", "Hyderabad"];

/**
 * Local/dev-only test users, standing in for the registration + invite flows
 * that ship in M2/M3. Covers the three post-login routing shapes from
 * unified-platform-architecture.md Section 5: single context (straight in),
 * multiple contexts (switcher), and a platform role.
 */
async function main() {
  for (const name of CATEGORIES) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const name of CITIES) {
    await prisma.city.upsert({ where: { name }, update: {}, create: { name } });
  }
  const mumbai = await prisma.city.findUniqueOrThrow({ where: { name: "Mumbai" } });
  const plumbing = await prisma.category.findUniqueOrThrow({ where: { name: "Plumbing" } });

  const vendorCompany = await prisma.vendorCompany.upsert({
    where: { ownerEmail: "owner@example.com" },
    update: {},
    create: {
      name: "Seed Plumbing Co",
      businessType: "PROPRIETORSHIP",
      ownerName: "Vendor Owner",
      ownerPhone: "9000000000",
      ownerEmail: "owner@example.com",
      registeredAddress: "1 Seed Street, Mumbai",
      status: "ACTIVE",
      serviceCategories: { connect: { id: plumbing.id } },
      citiesServed: { connect: { id: mumbai.id } },
    },
  });

  const societyOne = await prisma.society.upsert({
    where: { id: "seed-society-1" },
    update: {},
    create: {
      id: "seed-society-1",
      name: "Seed Society One",
      address: "2 Seed Street, Mumbai",
      cityId: mumbai.id,
      unitsCount: 120,
      registrantName: "Manager (multi context)",
      registrantRole: RoleName.MANAGER,
      registrantPhone: "9000000001",
      registrantEmail: "manager@example.com",
      secretaryName: "Seed Secretary",
      secretaryPhone: "9000000002",
      secretaryEmail: "secretary1@example.com",
      status: "ACTIVE",
    },
  });

  const societyTwo = await prisma.society.upsert({
    where: { id: "seed-society-2" },
    update: {},
    create: {
      id: "seed-society-2",
      name: "Seed Society Two",
      address: "3 Seed Street, Pune",
      cityId: mumbai.id,
      unitsCount: 80,
      registrantName: "Manager (multi context)",
      registrantRole: RoleName.MANAGER,
      registrantPhone: "9000000001",
      registrantEmail: "manager@example.com",
      secretaryName: "Seed Secretary Two",
      secretaryPhone: "9000000003",
      secretaryEmail: "secretary2@example.com",
      status: "ACTIVE",
    },
  });

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
          entityId: vendorCompany.id,
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
            entityId: societyOne.id,
            role: RoleName.MANAGER,
            permissions: ROLE_DEFAULT_PERMISSIONS[RoleName.MANAGER],
          },
          {
            entityType: "SOCIETY",
            entityId: societyTwo.id,
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
      name: "ProSoc Super Admin",
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
