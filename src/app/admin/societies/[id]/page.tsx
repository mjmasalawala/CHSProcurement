import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePagePermission } from "@/lib/admin-auth";
import { Card } from "@/components/ui/card";
import { ApproveRejectPanel } from "./panel";

export const dynamic = "force-dynamic";

export default async function AdminSocietyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission(PERMISSIONS.SOCIETY_QUEUE_ACCESS, `/admin/societies/${id}`);

  const society = await prisma.society.findUnique({
    where: { id },
    include: { city: true },
  });
  if (!society) notFound();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <Link href="/admin/societies" className="text-[13px] text-text-secondary underline hover:text-text-primary">
        ← Back to Societies
      </Link>
      <div>
        <h1 className="text-[24px] font-bold text-text-primary">{society.name}</h1>
        <p className="text-[13px] text-text-secondary">Status: {society.status}</p>
      </div>

      <Card className="flex flex-col gap-3">
        <Row label="City" value={society.city.name} />
        <Row label="Address" value={society.address} />
        <Row label="Units" value={String(society.unitsCount)} />
        <Row label="Registration Number" value={society.registrationNumber ?? "—"} />
        <Row
          label="Secretary"
          value={`${society.secretaryName} · ${society.secretaryEmail} · ${society.secretaryPhone}`}
        />
      </Card>

      <ApproveRejectPanel societyId={society.id} status={society.status} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] text-text-secondary">{label}</p>
      <p className="text-[15px] text-text-primary">{value}</p>
    </div>
  );
}
