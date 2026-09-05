import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyPagePermission } from "@/lib/society-auth";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { formatDate } from "@/lib/date";
import { SuggestVendorForm } from "./form";
import { ResendInviteButton } from "./resend-invite-button";

export const dynamic = "force-dynamic";

type RegistrationStatus = "INVITED" | "UNDER_REVIEW" | "REGISTERED";

const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  INVITED: "Invited",
  UNDER_REVIEW: "Under Review",
  REGISTERED: "Registered",
};

const REGISTRATION_STATUS_TONE: Record<RegistrationStatus, BadgeTone> = {
  INVITED: "neutral",
  UNDER_REVIEW: "warning",
  REGISTERED: "success",
};

export default async function SuggestVendorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSocietyPagePermission(id, PERMISSIONS.CREATE_REQUIREMENT, `/society/${id}/suggest-vendor`);

  const suggestions = await prisma.vendorSuggestion.findMany({
    where: { societyId: id },
    include: { suggestedByUser: true },
    orderBy: { createdAt: "desc" },
  });

  const vendorCompanies = suggestions.length
    ? await prisma.vendorCompany.findMany({
        where: {
          ownerEmail: { in: suggestions.map((s) => s.vendorEmail), mode: "insensitive" },
        },
        select: { ownerEmail: true, status: true },
      })
    : [];
  const companyStatusByEmail = new Map(
    vendorCompanies.map((c) => [c.ownerEmail.toLowerCase(), c.status]),
  );

  function registrationStatus(vendorEmail: string): RegistrationStatus {
    const companyStatus = companyStatusByEmail.get(vendorEmail.toLowerCase());
    if (!companyStatus) return "INVITED";
    return companyStatus === "ACTIVE" ? "REGISTERED" : "UNDER_REVIEW";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Ask a Vendor to Register</h1>
        <p className="text-[13px] text-text-secondary">
          Know a vendor who should be on Wisesoc? We&apos;ll email them an invite from you to register.
        </p>
      </div>

      <Card>
        <SuggestVendorForm societyId={id} />
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold text-text-primary">Asked so far ({suggestions.length})</h2>
        {suggestions.length === 0 ? (
          <p className="text-[13px] text-text-secondary">No vendors asked yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border-subtle text-text-tertiary">
                  <th className="pb-2 pr-2 text-[11px] font-semibold uppercase tracking-wide">Vendor</th>
                  <th className="pb-2 pr-2 text-[11px] font-semibold uppercase tracking-wide">Email</th>
                  <th className="pb-2 pr-2 text-[11px] font-semibold uppercase tracking-wide">Phone</th>
                  <th className="pb-2 pr-2 text-[11px] font-semibold uppercase tracking-wide">Suggested by</th>
                  <th className="pb-2 pr-2 text-[11px] font-semibold uppercase tracking-wide">Date</th>
                  <th className="pb-2 pr-2 text-[11px] font-semibold uppercase tracking-wide">Status</th>
                  <th className="pb-2 text-[11px] font-semibold uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => {
                  const status = registrationStatus(s.vendorEmail);
                  return (
                    <tr key={s.id} className="border-b border-border-subtle last:border-0">
                      <td className="py-2 pr-2 font-medium whitespace-nowrap text-text-primary">{s.vendorName}</td>
                      <td className="py-2 pr-2 whitespace-nowrap text-text-secondary">{s.vendorEmail}</td>
                      <td className="py-2 pr-2 whitespace-nowrap text-text-secondary">{s.vendorPhone ?? "—"}</td>
                      <td className="py-2 pr-2 whitespace-nowrap text-text-secondary">
                        {s.suggestedByUser.name ?? s.suggestedByUser.email}
                      </td>
                      <td className="py-2 pr-2 whitespace-nowrap text-text-secondary">{formatDate(s.createdAt)}</td>
                      <td className="py-2 pr-2 whitespace-nowrap">
                        <Badge tone={REGISTRATION_STATUS_TONE[status]}>
                          {REGISTRATION_STATUS_LABEL[status]}
                        </Badge>
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <ResendInviteButton societyId={id} vendorSuggestionId={s.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
