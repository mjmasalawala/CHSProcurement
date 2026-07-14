"use server";

import { Prisma } from "@/generated/prisma/client";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { ROLE_DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { notifyNewRegistration, notifyRegistrationSubmitted } from "@/lib/notifications";

export interface VendorRegistrationInput {
  name: string;
  businessType: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  registeredAddress: string;
  password: string;
  categoryIds: string[];
  requestedCategory: string;
  cityIds: string[];
  societiesServiced: string[];
  gstNumber: string;
  panNumber: string;
  yearsInBusiness: string;
  description: string;
}

/**
 * Vendor Owner gets a working login immediately at registration (product
 * decision, 2026-07-09 — differs from Society registration, where the
 * Secretary is invited only after admin approval). The VendorCompany itself
 * still starts PENDING_VERIFICATION and can't be matched to requirements
 * until an admin approves it (M3) — see vendor-registration-portal-spec.md
 * Section 3.
 */
export async function registerVendor(
  input: VendorRegistrationInput,
): Promise<{ error: string } | undefined> {
  if (input.categoryIds.length > 5) {
    return { error: "You can select up to 5 service categories." };
  }

  let vendorCompanyId: string;
  try {
    const passwordHash = await hashPassword(input.password);

    const vendorCompany = await prisma.vendorCompany.create({
      data: {
        name: input.name,
        businessType: input.businessType as Prisma.VendorCompanyCreateInput["businessType"],
        ownerName: input.ownerName,
        ownerEmail: input.ownerEmail,
        ownerPhone: input.ownerPhone,
        registeredAddress: input.registeredAddress,
        gstNumber: input.gstNumber || null,
        panNumber: input.panNumber || null,
        yearsInBusiness: input.yearsInBusiness ? Number(input.yearsInBusiness) : null,
        description: input.description || null,
        societiesServiced: input.societiesServiced,
        serviceCategories: { connect: input.categoryIds.map((id) => ({ id })) },
        citiesServed: { connect: input.cityIds.map((id) => ({ id })) },
      },
    });

    if (input.requestedCategory.trim()) {
      await prisma.categoryRequest.create({
        data: { name: input.requestedCategory.trim(), vendorCompanyId: vendorCompany.id },
      });
    }

    await prisma.user.create({
      data: {
        email: input.ownerEmail,
        name: input.ownerName,
        passwordHash,
        roleAssignments: {
          create: {
            entityType: "VENDOR_COMPANY",
            entityId: vendorCompany.id,
            role: "VENDOR_OWNER",
            permissions: ROLE_DEFAULT_PERMISSIONS.VENDOR_OWNER,
          },
        },
      },
    });

    vendorCompanyId = vendorCompany.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "An account with this email already exists." };
    }
    throw err;
  }

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await Promise.all([
    notifyNewRegistration({
      type: "Vendor",
      name: input.name,
      contactName: input.ownerName,
      contactEmail: input.ownerEmail,
      approveUrl: `${base}/admin/vendors/${vendorCompanyId}`,
    }),
    notifyRegistrationSubmitted({
      type: "Vendor",
      name: input.name,
      contactEmail: input.ownerEmail,
      contactPhone: input.ownerPhone,
    }),
  ]);

  await signIn("credentials", {
    email: input.ownerEmail,
    password: input.password,
    redirectTo: "/app",
  });
}
