import { PERMISSIONS } from "@/lib/permissions";
import { requirePagePermission } from "@/lib/admin-auth";
import { SupportPanel } from "./support-panel";

export default async function SupportPage() {
  await requirePagePermission(PERMISSIONS.IMPERSONATE_USER, "/admin/support");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Support</h1>
      <SupportPanel />
    </div>
  );
}
