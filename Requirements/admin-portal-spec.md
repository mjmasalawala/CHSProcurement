# Admin Portal — Feature Spec (v1 / MVP)
**Product:** Housing Society R&M Vendor Marketplace (Bluejay)
**Module:** Admin Portal — one module within the unified platform (see `unified-platform-architecture.md` for auth/roles model)
**Status:** Draft for development kickoff

---

## 1. Purpose

Internal Bluejay tooling to verify and approve vendors and societies before they go live, manage shared reference data (categories, cities), and provide basic oversight into how the marketplace is functioning.

---

## 2. Roles within this portal

| Role | Access |
|---|---|
| **Bluejay Ops — Vendor Queue** | Vendor approval queue, category-request approvals only |
| **Bluejay Ops — Society Queue** | Society approval queue only |
| **Bluejay Super Admin** | Both queues + taxonomy/city management + full directories |

Queues are kept **separate** (per your call) — different staff can be assigned to each without seeing the other's workload.

---

## 3. Vendor Approval Queue

- List view of vendor registrations with status `Pending Verification`, sortable/filterable by submission date, category, city.
- Click into a submission → view all Basic-tier fields submitted (see Vendor spec Section 4.1).
- Actions: **Approve** (status → Active, vendor notified) or **Reject** (reason required, free text, vendor notified and can resubmit).
- **Aging indicator:** flag submissions pending review for more than a configurable number of days (e.g., 3 days) so nothing sits unnoticed — simple list sort/highlight in v1, not a full alerting system.

### 3.1 Category Requests
- Separate sub-queue: vendors' requests for a new category not on the fixed list (submitted during their registration).
- Actions: **Approve** (adds to shared taxonomy, vendor notified, category now selectable platform-wide) or **Reject** (reason, vendor notified).

---

## 4. Society Approval Queue

- List view of society registrations with status `Pending Verification`.
- Click into a submission → view all Basic-tier fields (see Society spec Section 4.1), including the designated Secretary's details.
- Actions: **Approve** (status → Active, Secretary receives activation invite) or **Reject** (reason required, registrant notified).
- Same aging indicator pattern as vendor queue.

---

## 5. Shared Reference Data Management

- **Category taxonomy:** add/edit/deactivate categories directly (in addition to approving vendor-submitted requests above). Deactivating a category should not delete historical data tied to it — soft-disable only.
- **City list:** add/edit/deactivate cities served by the platform, same soft-disable principle.

---

## 6. Directories (read/search access)

- **Vendor Directory:** search/filter all vendors (Active, Pending, Rejected, Suspended) by name, category, city. Drill into a vendor to see profile, staff list, full bid history.
- **Society Directory:** search/filter all societies by name, city, status. Drill into a society to see roster (Manager + 3 OBs), requirement history, current approval threshold.

These are for internal visibility/support — not analytics dashboards in v1.

---

## 7. Basic oversight (manual, not automated, for v1)

Two simple lists Bluejay Ops can check periodically — not automated alerts or scoring in v1:

- **Requirements with fewer than 3 bids received** — filterable list, so Ops can manually check in with the society/vendors if something looks off.
- **Vendors pending verification longer than X days** — aging queue, covered above.

**Explicitly deferred to Phase 2:** automated anomaly detection (e.g., a society repeatedly selecting the same vendor, a vendor winning a suspiciously high share of bids in one society, bid amounts clustering suspiciously close together). Build the data model now so these are calculable later (every requirement, bid, and selection is already logged per the Society spec's archive), but don't build the detection logic or dashboard yet.

---

## 8. Explicitly out of scope for v1

- Automated anti-collusion/anomaly flagging (see Section 7)
- Dispute resolution workflow
- Billing/invoicing/payout management
- Permission-editor UI (roles/permissions are fixed per the architecture doc's matrix at launch)
- Platform-wide analytics dashboards (volume, GMV, funnel metrics) — directories and lists only in v1

---

---

## 9. Permission-gated UI components (this module)

| Component | Gate | Ops — Vendor Queue | Ops — Society Queue | Super Admin |
|---|---|---|---|---|
| Vendor Approval Queue | Vendor Queue role | ✅ | ❌ | ✅ |
| Category Request approvals | Vendor Queue role | ✅ | ❌ | ✅ |
| Society Approval Queue | Society Queue role | ❌ | ✅ | ✅ |
| Taxonomy management (categories) | Super Admin role | ❌ | ❌ | ✅ |
| City list management | Super Admin role | ❌ | ❌ | ✅ |
| Vendor Directory (search/drill-in) | Vendor Queue role or Super Admin | ✅ | ❌ | ✅ |
| Society Directory (search/drill-in) | Society Queue role or Super Admin | ❌ | ✅ | ✅ |

See `unified-platform-architecture.md` Section 8 for the platform-wide gating pattern.

---

*Companion documents: `unified-platform-architecture.md`, `vendor-registration-portal-spec.md`, `society-portal-spec.md`*
