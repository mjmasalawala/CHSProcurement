"use server";

import { Prisma } from "@/generated/prisma/client";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { ROLE_DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { notifyNewRegistration, notifyRegistrationSubmitted } from "@/lib/notifications";
import { getBaseUrl } from "@/lib/base-url";
import { sendPhoneVerificationCode, verifyPhoneVerificationCode } from "@/lib/phone-verification";

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
 *
 * "Immediately" now means "as soon as they verify their phone" — this
 * creates the VendorCompany + User and sends a WhatsApp OTP to ownerPhone,
 * but does not sign them in. verifyVendorRegistrationPhone below is what
 * actually starts the session, once the code is confirmed. If they abandon
 * the flow at the OTP screen, the account exists but is simply never signed
 * into — a known, accepted gap (no "resume verification" path exists yet;
 * retrying registration with the same email hits the P2002 case below).
 */
export async function registerVendor(
  input: VendorRegistrationInput,
): Promise<{ error: string } | undefined> {
  if (input.categoryIds.length > 5) {
    return { error: "You can select up to 5 service categories." };
  }

  let vendorCompanyId: string;
  let userId: string;
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

    const user = await prisma.user.create({
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
    userId = user.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "An account with this email already exists." };
    }
    throw err;
  }

  const base = getBaseUrl();
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

  try {
    await sendPhoneVerificationCode(userId, input.ownerPhone);
  } catch (err) {
    console.error("registerVendor: failed to send verification code", err);
    return { error: "Your account was created, but we couldn't send a verification code to that number. Contact support to finish setting up your login." };
  }
}

/** Re-sends a fresh code to the phone number given at registration. */
export async function resendVendorRegistrationCode(email: string, phone: string): Promise<{ error: string } | { ok: true }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: "Account not found." };

  try {
    await sendPhoneVerificationCode(user.id, phone.trim());
  } catch (err) {
    console.error("resendVendorRegistrationCode: failed to send verification code", err);
    return { error: "Couldn't resend the code — try again in a moment." };
  }

  return { ok: true };
}

/**
 * Confirms the WhatsApp OTP sent at the end of registerVendor, then signs
 * the new Vendor Owner in — this is what actually starts their session.
 */
export async function verifyVendorRegistrationPhone(
  email: string,
  code: string,
  password: string,
): Promise<{ error: string } | undefined> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: "Account not found." };

  const result = await verifyPhoneVerificationCode(user.id, code.trim());
  if ("error" in result) return result;

  await signIn("credentials", { email, password, redirectTo: "/app" });
}
