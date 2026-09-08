import { prisma } from "@/lib/prisma";

const WEEKS = 12;

// Monday-start week bucket, computed in UTC so the bucketing is stable
// regardless of the server's local timezone.
function startOfWeekUTC(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function lastNWeekStarts(n: number): Date[] {
  const current = startOfWeekUTC(new Date());
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(current);
    d.setUTCDate(d.getUTCDate() - (n - 1 - i) * 7);
    return d;
  });
}

function bucketWeekly(dates: Date[], weekStarts: Date[]): number[] {
  const indexByTime = new Map(weekStarts.map((w, i) => [w.getTime(), i]));
  const counts = new Array(weekStarts.length).fill(0);
  for (const date of dates) {
    const idx = indexByTime.get(startOfWeekUTC(date).getTime());
    if (idx !== undefined) counts[idx]++;
  }
  return counts;
}

export interface WeeklySeriesValues {
  weekLabels: string[];
  values: number[];
}

/** New Vendor registrations per week, over the trailing WEEKS weeks. */
export async function getVendorOnboardingsOverTime(): Promise<WeeklySeriesValues> {
  const weekStarts = lastNWeekStarts(WEEKS);
  const vendors = await prisma.vendorCompany.findMany({
    where: { createdAt: { gte: weekStarts[0] } },
    select: { createdAt: true },
  });

  return { weekLabels: weekStarts.map(weekLabel), values: bucketWeekly(vendors.map((v) => v.createdAt), weekStarts) };
}

/** New Society registrations per week, over the trailing WEEKS weeks. */
export async function getSocietyOnboardingsOverTime(): Promise<WeeklySeriesValues> {
  const weekStarts = lastNWeekStarts(WEEKS);
  const societies = await prisma.society.findMany({
    where: { createdAt: { gte: weekStarts[0] } },
    select: { createdAt: true },
  });

  return { weekLabels: weekStarts.map(weekLabel), values: bucketWeekly(societies.map((s) => s.createdAt), weekStarts) };
}

function weekLabel(weekStart: Date): string {
  const day = weekStart.getUTCDate().toString().padStart(2, "0");
  const month = weekStart.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${day} ${month}`;
}

export interface CategoryVendorCount {
  categoryId: string;
  categoryName: string;
  activeVendorCount: number;
}

/**
 * Active vendor count per service category (categories with no active
 * vendors are omitted), sorted by count descending, plus the total distinct
 * count of active vendors — not the sum of the per-category counts, since a
 * vendor can carry more than one category.
 */
export async function getActiveVendorsByCategory(): Promise<{
  categories: CategoryVendorCount[];
  totalActiveVendors: number;
}> {
  const [categories, totalActiveVendors] = await Promise.all([
    prisma.category.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { vendorCompanies: { where: { status: "ACTIVE" } } } },
      },
    }),
    prisma.vendorCompany.count({ where: { status: "ACTIVE" } }),
  ]);

  const rows = categories
    .map((c) => ({ categoryId: c.id, categoryName: c.name, activeVendorCount: c._count.vendorCompanies }))
    .filter((c) => c.activeVendorCount > 0)
    .sort((a, b) => b.activeVendorCount - a.activeVendorCount || a.categoryName.localeCompare(b.categoryName));

  return { categories: rows, totalActiveVendors };
}

export interface VendorResponseStats {
  vendorCompanyId: string;
  vendorName: string;
  bidCount: number;
  avgResponseHours: number;
}

/**
 * Response time = time between a vendor being invited to a Requirement
 * (RequirementInvite.createdAt) and that vendor submitting a Bid on it
 * (Bid.createdAt) — the only "how fast do they respond" signal the schema
 * has, since there's no separate "viewed" event.
 */
export async function getVendorResponseStats(): Promise<VendorResponseStats[]> {
  const [invites, bids] = await Promise.all([
    prisma.requirementInvite.findMany({
      select: { requirementId: true, vendorCompanyId: true, createdAt: true },
    }),
    prisma.bid.findMany({
      select: {
        requirementId: true,
        vendorCompanyId: true,
        createdAt: true,
        vendorCompany: { select: { name: true } },
      },
    }),
  ]);

  const inviteTimeByKey = new Map(invites.map((i) => [`${i.requirementId}:${i.vendorCompanyId}`, i.createdAt]));

  const hoursByVendor = new Map<string, { name: string; hours: number[] }>();
  for (const bid of bids) {
    const invitedAt = inviteTimeByKey.get(`${bid.requirementId}:${bid.vendorCompanyId}`);
    if (!invitedAt) continue;

    const hours = (bid.createdAt.getTime() - invitedAt.getTime()) / (1000 * 60 * 60);
    if (hours < 0) continue;

    const entry = hoursByVendor.get(bid.vendorCompanyId) ?? { name: bid.vendorCompany.name, hours: [] };
    entry.hours.push(hours);
    hoursByVendor.set(bid.vendorCompanyId, entry);
  }

  return Array.from(hoursByVendor.entries()).map(([vendorCompanyId, { name, hours }]) => ({
    vendorCompanyId,
    vendorName: name,
    bidCount: hours.length,
    avgResponseHours: hours.reduce((a, b) => a + b, 0) / hours.length,
  }));
}

export function averageResponseHours(stats: VendorResponseStats[]): number | null {
  if (stats.length === 0) return null;

  const totalBids = stats.reduce((sum, s) => sum + s.bidCount, 0);
  const totalHours = stats.reduce((sum, s) => sum + s.avgResponseHours * s.bidCount, 0);
  return totalHours / totalBids;
}

export function topRespondingVendors(stats: VendorResponseStats[], limit = 10): VendorResponseStats[] {
  return [...stats].sort((a, b) => a.avgResponseHours - b.avgResponseHours).slice(0, limit);
}

export function formatResponseHours(hours: number): string {
  if (hours < 24) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)}h`;
  const days = hours / 24;
  return `${days < 10 ? days.toFixed(1) : Math.round(days)}d`;
}

export interface InactiveSociety {
  id: string;
  name: string;
  cityName: string;
  secretaryName: string;
  secretaryEmail: string;
  approvedAt: Date | null;
}

/** Active societies that have never raised a single Requirement. */
export async function getSocietiesWithNoRequirements(): Promise<InactiveSociety[]> {
  const societies = await prisma.society.findMany({
    where: { status: "ACTIVE", requirements: { none: {} } },
    select: {
      id: true,
      name: true,
      secretaryName: true,
      secretaryEmail: true,
      approvedAt: true,
      city: { select: { name: true } },
    },
    orderBy: { approvedAt: "asc" },
  });

  return societies.map((s) => ({
    id: s.id,
    name: s.name,
    cityName: s.city.name,
    secretaryName: s.secretaryName,
    secretaryEmail: s.secretaryEmail,
    approvedAt: s.approvedAt,
  }));
}
