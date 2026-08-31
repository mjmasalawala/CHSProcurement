import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePagePermission } from "@/lib/admin-auth";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-badge";
import { formatDate } from "@/lib/date";
import { SearchInput } from "@/components/ui/search-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { ResendInvitationButton } from "./resend-invitation-button";

export const dynamic = "force-dynamic";

// "Invited" isn't an EntityStatus — it's a vendor lead a society has
// suggested (VendorSuggestion) who has never created a VendorCompany, so it
// only exists here, in the combined directory view.
type DirectoryStatus = "INVITED" | "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "REJECTED";

const STATUS_OPTIONS: { value: DirectoryStatus; label: string }[] = [
  { value: "INVITED", label: "Invited" },
  { value: "PENDING_VERIFICATION", label: "Pending" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "REJECTED", label: "Rejected" },
];

function directoryStatusTone(status: DirectoryStatus): BadgeTone {
  return status === "INVITED" ? "info" : statusTone(status);
}

function directoryStatusLabel(status: DirectoryStatus): string {
  return status === "INVITED" ? "Invited" : statusLabel(status);
}

interface DirectoryRow {
  key: string;
  name: string;
  email: string;
  phone: string | null;
  categories: string[];
  categoryIds: string[];
  cityIds: string[];
  status: DirectoryStatus;
  date: Date;
  vendorCompanyId: string | null;
  suggestionId: string | null;
}

interface SearchParams {
  q?: string;
  category?: string;
  city?: string;
  status?: string;
}

export default async function VendorDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePagePermission(PERMISSIONS.VENDOR_DIRECTORY_ACCESS, "/admin/vendor-directory");

  const params = await searchParams;

  const [companies, suggestions, categories, cities] = await Promise.all([
    prisma.vendorCompany.findMany({
      include: { serviceCategories: true, citiesServed: true },
    }),
    // Not scoped to a society — this directory spans every society's leads,
    // so an admin can resend an invite regardless of who originally asked.
    prisma.vendorSuggestion.findMany({
      include: { society: true, suggestedByUser: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.city.findMany({ orderBy: { name: "asc" } }),
  ]);

  const companyEmails = new Set(companies.map((c) => c.ownerEmail.toLowerCase()));

  // Ascending order means the last write per email wins, i.e. the most
  // recent suggestion — the one worth showing/resending when several
  // societies have suggested the same vendor.
  const latestSuggestionByEmail = new Map<string, (typeof suggestions)[number]>();
  for (const s of suggestions) latestSuggestionByEmail.set(s.vendorEmail.toLowerCase(), s);

  const rows: DirectoryRow[] = companies.map((vendor) => ({
    key: vendor.id,
    name: vendor.name,
    email: vendor.ownerEmail,
    phone: vendor.ownerPhone,
    categories: vendor.serviceCategories.map((c) => c.name),
    categoryIds: vendor.serviceCategories.map((c) => c.id),
    cityIds: vendor.citiesServed.map((c) => c.id),
    status: vendor.status,
    date: vendor.createdAt,
    vendorCompanyId: vendor.id,
    suggestionId: null,
  }));

  for (const [email, s] of latestSuggestionByEmail) {
    if (companyEmails.has(email)) continue;
    rows.push({
      key: `invite-${s.id}`,
      name: s.vendorName,
      email: s.vendorEmail,
      phone: s.vendorPhone,
      categories: [],
      categoryIds: [],
      cityIds: [],
      status: "INVITED",
      date: s.createdAt,
      vendorCompanyId: null,
      suggestionId: s.id,
    });
  }

  let filtered = rows;
  if (params.status) {
    const selectedStatuses = params.status.split(",").filter(Boolean);
    filtered = filtered.filter((r) => selectedStatuses.includes(r.status));
  }
  if (params.category) {
    const selectedCategories = params.category.split(",").filter(Boolean);
    filtered = filtered.filter((r) => r.categoryIds.some((id) => selectedCategories.includes(id)));
  }
  if (params.city) filtered = filtered.filter((r) => r.cityIds.includes(params.city!));
  if (params.q) {
    const needle = params.q.trim().toLowerCase();
    filtered = filtered.filter(
      (r) => r.name.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle),
    );
  }
  filtered.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Vendor Directory</h1>
        <p className="text-[13px] text-text-secondary">
          Every vendor on the platform — suggested, registered, or acted on — in one list.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:max-w-xs sm:flex-1">
          <SearchInput placeholder="Search by name or email…" />
        </div>
        <FilterMultiSelect
          paramName="category"
          placeholder="All categories"
          className="sm:w-64"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect
          paramName="city"
          placeholder="All cities"
          className="sm:w-48"
          options={cities.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterMultiSelect
          paramName="status"
          placeholder="All statuses"
          className="sm:w-64"
          options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-[13px] text-text-secondary">No vendors match these filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border-subtle text-text-tertiary">
                <th className="pb-2 pr-4 text-[11px] font-semibold uppercase tracking-wide">Vendor</th>
                <th className="pb-2 pr-4 text-[11px] font-semibold uppercase tracking-wide">Email</th>
                <th className="pb-2 pr-4 text-[11px] font-semibold uppercase tracking-wide">Phone</th>
                <th className="pb-2 pr-4 text-[11px] font-semibold uppercase tracking-wide">Categories</th>
                <th className="pb-2 pr-4 text-[11px] font-semibold uppercase tracking-wide">Status</th>
                <th className="pb-2 pr-4 text-[11px] font-semibold uppercase tracking-wide">Date</th>
                <th className="pb-2 text-[11px] font-semibold uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.key} className="border-b border-border-subtle last:border-0">
                  <td className="py-3 pr-4 font-medium whitespace-nowrap text-text-primary">
                    {row.vendorCompanyId ? (
                      <Link href={`/admin/vendors/${row.vendorCompanyId}`} className="hover:underline">
                        {row.name}
                      </Link>
                    ) : (
                      row.name
                    )}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap text-text-secondary">{row.email}</td>
                  <td className="py-3 pr-4 whitespace-nowrap text-text-secondary">{row.phone ?? "—"}</td>
                  <td className="py-3 pr-4 text-text-secondary">{row.categories.join(", ") || "—"}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <Badge tone={directoryStatusTone(row.status)}>{directoryStatusLabel(row.status)}</Badge>
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap text-text-secondary">{formatDate(row.date)}</td>
                  <td className="py-3 whitespace-nowrap">
                    {row.suggestionId ? (
                      <ResendInvitationButton vendorSuggestionId={row.suggestionId} />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
