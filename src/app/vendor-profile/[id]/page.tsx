import { redirect } from "next/navigation";

/**
 * Redirect-only route — exists purely so the wisesoc_vendor_approved_v1
 * WhatsApp template's "Update Profile" button has somewhere valid to link
 * to. Meta's dynamic URL buttons only allow the variable as a bare
 * trailing suffix on a fixed base URL — nothing static may follow it — so
 * the button can't point straight at /vendor/{id}/profile (the /profile
 * segment comes after the id). This route's own URL has nothing after the
 * id, satisfying that constraint, and just forwards on to the real page.
 */
export default async function VendorProfileRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/vendor/${id}/profile`);
}
