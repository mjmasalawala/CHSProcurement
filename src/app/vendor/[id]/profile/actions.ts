"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/permissions";
import { requireVendorActionPermission } from "@/lib/vendor-auth";
import { revalidatePath } from "next/cache";

export interface VendorProfileInput {
  name: string;
  businessType: string;
  ownerName: string;
  ownerPhone: string;
  registeredAddress: string;
  categoryIds: string[];
  cityIds: string[];
  societiesServiced: string[];
  yearsInBusiness: string;
  description: string;
}

export async function updateVendorProfile(
  vendorCompanyId: string,
  input: VendorProfileInput,
): Promise<{ error: string } | undefined> {
  await requireVendorActionPermission(vendorCompanyId, PERMISSIONS.EDIT_COMPANY_PROFILE);

  if (input.categoryIds.length > 5) {
    return { error: "You can select up to 5 service categories." };
  }

  await prisma.vendorCompany.update({
    where: { id: vendorCompanyId },
    data: {
      name: input.name,
      businessType: input.businessType as Prisma.VendorCompanyUpdateInput["businessType"],
      ownerName: input.ownerName,
      ownerPhone: input.ownerPhone,
      registeredAddress: input.registeredAddress,
      yearsInBusiness: input.yearsInBusiness ? Number(input.yearsInBusiness) : null,
      description: input.description || null,
      societiesServiced: input.societiesServiced,
      serviceCategories: { set: input.categoryIds.map((id) => ({ id })) },
      citiesServed: { set: input.cityIds.map((id) => ({ id })) },
    },
  });

  revalidatePath(`/vendor/${vendorCompanyId}/profile`);
}
