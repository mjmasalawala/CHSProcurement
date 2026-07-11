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
    where: { email: "secretary1@example.com" },
    update: {},
    create: {
      email: "secretary1@example.com",
      name: "Seed Secretary",
      passwordHash,
      roleAssignments: {
        create: {
          entityType: "SOCIETY",
          entityId: societyOne.id,
          role: RoleName.SECRETARY,
          permissions: ROLE_DEFAULT_PERMISSIONS[RoleName.SECRETARY],
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "chairman1@example.com" },
    update: {},
    create: {
      email: "chairman1@example.com",
      name: "Seed Chairman",
      passwordHash,
      roleAssignments: {
        create: {
          entityType: "SOCIETY",
          entityId: societyOne.id,
          role: RoleName.CHAIRMAN,
          permissions: ROLE_DEFAULT_PERMISSIONS[RoleName.CHAIRMAN],
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "treasurer1@example.com" },
    update: {},
    create: {
      email: "treasurer1@example.com",
      name: "Seed Treasurer",
      passwordHash,
      roleAssignments: {
        create: {
          entityType: "SOCIETY",
          entityId: societyOne.id,
          role: RoleName.TREASURER,
          permissions: ROLE_DEFAULT_PERMISSIONS[RoleName.TREASURER],
        },
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

  const vendorOwnerUser = await prisma.user.findUniqueOrThrow({ where: { email: "owner@example.com" } });

  // M4 test fixtures: real Requirement Creation (matching engine, Manager
  // gate) lands in M5, so these are hand-seeded to give the M4 vendor portal
  // (Requirements Inbox, Bid Submission, My Bids) something real to show.
  const openRequirement = await prisma.requirement.upsert({
    where: { id: "seed-requirement-open" },
    update: {},
    create: {
      id: "seed-requirement-open",
      societyId: societyOne.id,
      categoryId: plumbing.id,
      description: "Fix recurring leak in the ground-floor common bathroom and replace worn-out fittings.",
      urgency: "URGENT",
      budgetBand: "₹10,000 - ₹25,000",
      bidDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const closedRequirement = await prisma.requirement.upsert({
    where: { id: "seed-requirement-closed" },
    update: {},
    create: {
      id: "seed-requirement-closed",
      societyId: societyOne.id,
      categoryId: plumbing.id,
      description: "Annual plumbing maintenance across all common-area bathrooms.",
      urgency: "ROUTINE",
      budgetBand: "₹25,000 - ₹50,000",
      bidDeadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  // M6 test fixture: a closed requirement with a bid below societyOne's
  // default ₹1,000 threshold, for exercising the auto-finalize path
  // (society-portal-spec.md Section 7) without touching the OB-approval one
  // that seed-requirement-closed's ₹32,000 bid already covers.
  const belowThresholdRequirement = await prisma.requirement.upsert({
    where: { id: "seed-requirement-below-threshold" },
    update: {},
    create: {
      id: "seed-requirement-below-threshold",
      societyId: societyOne.id,
      categoryId: plumbing.id,
      description: "Replace a single tap washer in the security cabin.",
      urgency: "ROUTINE",
      bidDeadline: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  for (const requirement of [openRequirement, closedRequirement, belowThresholdRequirement]) {
    await prisma.requirementInvite.upsert({
      where: {
        requirementId_vendorCompanyId: {
          requirementId: requirement.id,
          vendorCompanyId: vendorCompany.id,
        },
      },
      update: {},
      create: { requirementId: requirement.id, vendorCompanyId: vendorCompany.id },
    });
  }

  await prisma.bid.upsert({
    where: {
      requirementId_vendorCompanyId: {
        requirementId: closedRequirement.id,
        vendorCompanyId: vendorCompany.id,
      },
    },
    update: {},
    create: {
      requirementId: closedRequirement.id,
      vendorCompanyId: vendorCompany.id,
      submittedByUserId: vendorOwnerUser.id,
      totalAmount: 32000,
      bidValidity: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes: "Includes 6-month warranty on all fittings replaced.",
      lineItems: {
        create: [
          { description: "Bathroom fitting replacement", quantity: 8, unit: "nos", unitRate: 3000, amount: 24000 },
          { description: "Common area pipe inspection", quantity: 4, unit: "hour", unitRate: 2000, amount: 8000 },
        ],
      },
    },
  });

  await prisma.bid.upsert({
    where: {
      requirementId_vendorCompanyId: {
        requirementId: belowThresholdRequirement.id,
        vendorCompanyId: vendorCompany.id,
      },
    },
    update: {},
    create: {
      requirementId: belowThresholdRequirement.id,
      vendorCompanyId: vendorCompany.id,
      submittedByUserId: vendorOwnerUser.id,
      totalAmount: 800,
      bidValidity: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lineItems: {
        create: [{ description: "Tap washer replacement", quantity: 1, unit: "nos", unitRate: 800, amount: 800 }],
      },
    },
  });

  console.log(
    "Seeded: owner@example.com, manager@example.com, secretary1@example.com, chairman1@example.com, treasurer1@example.com, admin@example.com (password: password123)",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
