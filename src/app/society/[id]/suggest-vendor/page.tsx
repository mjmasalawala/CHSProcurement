import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSocietyPagePermission } from "@/lib/society-auth";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { formatDate } from "@/lib/date";
import { SuggestVendorForm } from "./form";
import { ResendInviteButton } from "./resend-invite-button";

export const dynamic = "force-dynamic";

type RegistrationStatus = "INVITED" | "UNDER_REVIEW" | "REGISTERED" | "REJECTED";

const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  INVITED: "Invited",
  UNDER_REVIEW: "Under Review",
  REGISTERED: "Registered",
  REJECTED: "Rejected",
};

const REGISTRATION_STATUS_TONE: Record<RegistrationStatus, BadgeTone> = {
  INVITED: "neutral",
  UNDER_REVIEW: "warning",
  REGISTERED: "success",
  REJECTED: "error",
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
    if (companyStatus === "ACTIVE") return "REGISTERED";
    if (companyStatus === "REJECTED") return "REJECTED";
    return "UNDER_REVIEW";
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
          <>
            {/* Mobile: card list */}
            <div className="flex flex-col gap-2 md:hidden">
              {suggestions.map((s) => {
                const status = registrationStatus(s.vendorEmail);
                return (
                  <div
                    key={s.id}
                    className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-background-primary p-4 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[15px] font-semibold text-text-primary">{s.vendorName}</p>
                      <Badge tone={REGISTRATION_STATUS_TONE[status]} className="shrink-0">
                        {REGISTRATION_STATUS_LABEL[status]}
                      </Badge>
                    </div>
                    <div className="text-[13px] text-text-secondary">
                      <p className="break-words">{s.vendorEmail}</p>
                      <p>{s.vendorPhone ?? "—"}</p>
                    </div>
                    <p className="text-[13px] text-text-tertiary">
                      Asked by {s.suggestedByUser.name ?? s.suggestedByUser.email} · {formatDate(s.createdAt)}
                    </p>
                    {status !== "REGISTERED" && (
                      <ResendInviteButton societyId={id} vendorSuggestionId={s.id} fullWidth />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border-subtle text-text-tertiary">
                    <th className="pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wide">Vendor</th>
                    <th className="pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wide">Suggested by</th>
                    <th className="pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wide">Status</th>
                    <th className="pb-2 text-[11px] font-semibold uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s) => {
                    const status = registrationStatus(s.vendorEmail);
                    return (
                      <tr key={s.id} className="border-b border-border-subtle last:border-0">
                        <td className="py-2 pr-3 align-top">
                          <p className="font-medium text-text-primary">{s.vendorName}</p>
                          <p className="text-text-secondary">{s.vendorEmail}</p>
                          <p className="text-text-tertiary">{s.vendorPhone ?? "—"}</p>
                        </td>
                        <td className="py-2 pr-3 align-top whitespace-nowrap text-text-secondary">
                          <p>{s.suggestedByUser.name ?? s.suggestedByUser.email}</p>
                          <p className="text-text-tertiary">{formatDate(s.createdAt)}</p>
                        </td>
                        <td className="py-2 pr-3 align-top whitespace-nowrap">
                          <Badge tone={REGISTRATION_STATUS_TONE[status]}>
                            {REGISTRATION_STATUS_LABEL[status]}
                          </Badge>
                        </td>
                        <td className="py-2 align-top whitespace-nowrap">
                          {status === "REGISTERED" ? (
                            <span className="text-[13px] text-text-tertiary">—</span>
                          ) : (
                            <ResendInviteButton societyId={id} vendorSuggestionId={s.id} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
