# Vendor Registration Portal — Feature Spec (v1 / MVP)
**Product:** Housing Society R&M Vendor Marketplace (Bluejay)
**Module:** Vendor Portal — one module within a single unified SaaS application (one login, one URL; see `unified-platform-architecture.md` for how routing/roles work across all modules)
**Status:** Draft for development kickoff

> **Note:** This document was originally drafted assuming phone+OTP login. That's been superseded — see the Section 3/9 updates below and the architecture doc for the finalized auth model (Google Sign-In or email+password, encrypted, applies platform-wide).

---

## 1. Purpose

Allow vendors (contractors/suppliers of R&M and CapEx services) to self-register, get admin-verified, and once approved, become eligible to be matched and invited to bid on society requirements. This portal is the *supply side* of the marketplace.

---

## 2. User roles within this portal

| Role | Description | Permissions |
|---|---|---|
| **Vendor Owner** | The person who initially registers the company | Full access: edit company profile, KYC fields, add/remove staff, view/submit bids, view all company bid history |
| **Vendor Staff** | Added by the Owner | View requirements, submit/edit bids on behalf of the company. Cannot edit company profile, KYC, or manage other staff |

- One company = one Vendor Account. Multiple logins (Owner + Staff) map to that one account.
- Staff invited via phone number or email; they set their own password/login on first access.
- Owner can deactivate a staff login at any time (staff's past bid submissions remain attributed to them in the audit trail even after deactivation).

---

## 3. Registration flow (self-serve)

1. Vendor receives or navigates to a public registration link (shareable — societies can also forward this link to a vendor they want to nominate; nomination does **not** guarantee selection, it only gets the vendor into the pool for admin review).
2. Vendor fills registration form (see Section 4 — Basic GUI fields).
3. On submit → account status = **Pending Verification**. Vendor can log in and see their profile/status but **cannot** be matched to or view any requirements yet.
4. Admin reviews submission in the Admin Portal (separate spec) → Approves or Rejects (with reason).
5. On approval → status = **Active** → vendor becomes eligible for matching.
6. On rejection → vendor notified with reason, can edit and resubmit.
7. Vendor Owner can then invite Staff users (only once account is Active).

**Status states:** `Pending Verification` → `Active` | `Rejected` | `Suspended` (admin can suspend an active vendor later — e.g. for non-response or complaints; out of scope for this build but the status field should support it now).

---

## 4. Registration form — fields

### 4.1 GUI fields shown in v1 (Basic tier)

| Field | Type | Required? | Notes |
|---|---|---|---|
| Company / Business Name | Text | Yes | |
| Business Type | Dropdown | Yes | Proprietorship / Partnership / Private Limited / LLP / Other |
| Owner Name | Text | Yes | |
| Owner Phone | Text | Yes | Contact number, not used for login |
| Owner Email | Text | Yes | Used for login (email+password or Google Sign-In — see architecture doc) |
| Registered Address | Text (multi-line) | Yes | |
| Service Categories | Multi-select from fixed list | Yes | See Section 5 |
| "Request a new category" | Text + submit | Optional | Sends request to Admin queue; does not block registration |
| Cities Served | Multi-select | Yes | See Section 6 |
| Societies Already Serviced (optional) | Free text / tag input, multiple entries | Optional | See Section 6 |
| GST Number | Text | Optional (not verified in v1) | |
| PAN Number | Text | Optional (not verified in v1) | |
| Years in Business | Number | Optional | |
| Short Description / About | Text area | Optional | |

### 4.2 DB fields present but NOT in v1 GUI (Standard tier — build now, expose later)

Build these as schema fields / nullable columns now so Phase 2 doesn't require a migration:

- Trade License Number + expiry date
- Insurance details (policy number, coverage, expiry)
- Document uploads (GST certificate, PAN card, trade license, insurance certificate) — file storage references
- Verification status per document (Not Submitted / Pending / Verified / Expired)
- Bank account details for payout (account number, IFSC, account holder name)
- Past work references (client name, contact, description) — repeatable group

> **Dev note:** Design the vendor profile table/schema with these fields present (nullable, unused) from day one. The GUI simply won't render input controls for them yet. This avoids a re-architecture when KYC is tightened later.

---

## 5. Service category taxonomy

- Maintained as a **fixed, admin-managed list** (e.g., Plumbing, Electrical, Painting, Civil/Masonry, Waterproofing, Lift/Elevator AMC, Pest Control, Housekeeping, Landscaping, Fire Safety, Security Systems, etc. — final list to be confirmed with Admin Portal spec).
- Vendor selects one or more categories (multi-select) that apply to their business.
- Vendor can submit a **"Request New Category"** entry (free text) if their trade isn't listed. This goes into an Admin approval queue as a separate object — it does **not** block or hold up the vendor's registration submission.
- Category list is a shared reference table used by both Vendor Portal and Society Portal (for requirement creation) — build as a shared/central taxonomy service, not duplicated per-module.

---

## 6. Service area

- **Cities Served:** multi-select from a maintained city list (same kind of admin-managed reference list as categories — start with the cities you're piloting in, expandable).
- **Societies Already Serviced:** free-form, repeatable tag/text entries where vendor names societies they currently work with. This is **supplementary metadata**, not a geo-matching input in v1 — it's there to (a) build a data asset for future "this vendor already has a track record near you" signals, and (b) flag if a vendor is disproportionately tied to one society (useful for the fairness monitoring you'll want in the Admin Portal later).
- Matching in v1 will use **City** as the geo-filter. Radius/pincode-level matching is a Phase 2 refinement once there's enough vendor density per city to make it meaningful.

---

## 7. Vendor dashboard (post-login, once Active)

MVP scope only:

- **Profile** — view/edit company info (Owner only)
- **Requirements Inbox** — list of requirements the vendor has been matched/invited to, with status: New / Bid Submitted / Not Selected / Won
- **Bid Submission Screen** — structured form: line items (description, qty, unit rate, amount), auto-computed total, bid validity period, optional notes. No PDF upload in v1 (see Section 8).
- **My Bids / History** — all past bids submitted, with outcome, filterable by status/date
- **Staff Management** (Owner only) — add/remove staff, view staff activity log (who submitted which bid)

Not in v1: ratings/performance score visible to vendor, payment/invoice tracking, category-request status tracker (admin communicates via notification instead).

---

## 8. Bid submission — structure

Vendors submit **structured line-items only** (no PDF-only quotations) so bids are machine-comparable on the Society Portal side.

| Field | Type |
|---|---|
| Line item description | Text |
| Quantity | Number |
| Unit | Dropdown (sqft, nos, lump sum, etc.) |
| Unit Rate | Number |
| Amount | Auto-calculated (qty × rate) |
| Total Bid Amount | Auto-summed across line items |
| Bid Validity | Date |
| Notes/Terms | Text area, optional |

> **Dev note:** Since blind bidding matters, ensure vendors cannot see any other vendor's bid — not the amount, not whether a bid was submitted, not the count of competitors — until the requirement is closed and a selection is made (and even then, only their own bid's outcome, not competitors' figures, unless a future transparency feature decides otherwise).

---

## 9. Notifications (v1)

Channels: **Email + SMS**. (WhatsApp deferred to Phase 2 — flag this as an easy future integration, don't build around its absence.)

Trigger events:
- Registration submitted (confirmation)
- Registration approved / rejected
- New requirement matched (invite to bid)
- Bid deadline reminder (e.g., 24 hrs before close)
- Bid outcome (won / not selected)
- New category request approved/rejected
- Staff account invited / activated

---

## 10. Explicitly out of scope for v1 (do not build)

- Document upload + automated verification (schema ready, UI not)
- Vendor ratings/reviews
- Rate card / standing price catalog
- Radius-based geo-matching (city-level only for now)
- Payment/invoicing/payout flows
- WhatsApp notifications
- Vendor-visible performance analytics
- Vendor subscription/registration fees

---

## 11. Open items for Admin Portal spec (dependency, not blocking this build)

- Final category taxonomy list
- Final city list for pilot
- Admin approval queue UI/workflow (referenced here but specified separately)
- Category-request approval workflow (referenced here but specified separately)

---

---

## 12. Permission-gated UI components (this module)

| Component | Gate | Owner | Staff |
|---|---|---|---|
| Edit company profile / KYC fields | `owner` role | ✅ | ❌ |
| Manage Staff tab (add/remove/deactivate) | `manage_staff` | ✅ | ❌ |
| Requirements Inbox (view) | base role | ✅ | ✅ |
| Submit/Edit Bid | base role | ✅ | ✅ |
| My Bids / History (own bids only) | base role | ✅ | ✅ (sees own submissions; Owner sees all company submissions) |
| Staff activity log (who bid on what) | `manage_staff` | ✅ | ❌ |

See `unified-platform-architecture.md` Section 8 for the platform-wide pattern this follows.

---

*Next in this series: Society Registration & Society Portal spec (covers Manager + 3 Office Bearer roles, 2-of-3 quotation approval workflow, requirement creation, bid comparison view).*
