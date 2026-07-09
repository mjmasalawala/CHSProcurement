# Unified Platform Architecture — Auth, Roles & Permissions
**Product:** Housing Society R&M Vendor Marketplace (Bluejay)
**Status:** Draft for development kickoff — read this before the Vendor / Society / Admin module specs

---

## 1. Purpose

This is a **single SaaS application, one URL, one login page**. There are no separate "portals" as separate apps — Vendor, Society, and Admin are *sections* of the same product, and what a logged-in user sees (which screens, which data, which actions) is entirely driven by their role and permissions, resolved after login.

**Dev note:** Build this as one codebase / one deployed frontend with role-based routing, and one backend API with permission checks on every endpoint — not three separate apps stitched together behind a router. Don't over-architect into microfrontends for MVP.

---

## 2. Login mechanism

- **Google Sign-In** or **Email + Password**, user's choice — applies to every role (vendor, society, admin) across the whole platform.
- Passwords stored encrypted (bcrypt/argon2 — never plaintext, never reversible encryption).
- Phone numbers are captured as **contact details** (for SMS notifications) but are **not** a login credential in v1.
- One login page for the entire platform. After authentication, the system resolves the user's role(s)/permissions and routes accordingly (see Section 5).

---

## 3. Account & entity model

Three top-level entity types own data on the platform:

| Entity | Description |
|---|---|
| **Vendor Company** | A registered vendor business. Has an Owner + optional Staff users. |
| **Society** | A single housing society. Has a Secretary (default admin), Chairman, Treasurer, and a Manager. |
| **Bluejay (Platform)** | The operator. Has internal Ops/Admin users. |

**Users are separate from entities.** A User (login identity) holds one or more **Role Assignments**, and each Role Assignment links that User to a specific entity (a specific Vendor Company or a specific Society) with a specific role and permission set.

This matters because of two real cases already confirmed:
- A **Manager** (or management company) can be linked to **multiple Societies** — one login, several society contexts.
- A **Vendor Owner** can have **Staff** — multiple logins under one Vendor Company.

**Dev note:** Model this as a `users` table + a `role_assignments` table (user_id, entity_type, entity_id, role, permissions[]) — not as a `role` column directly on the user. This is what makes "one manager, five societies" and "one login, multiple permission contexts" possible without special-casing.

---

## 4. Roles & permissions matrix

| Role | Entity | Core actions | Special permissions |
|---|---|---|---|
| Vendor Owner | Vendor Company | Edit profile/KYC, submit bids, manage staff | `manage_staff` |
| Vendor Staff | Vendor Company | View requirements, submit/edit bids | — |
| Manager | Society (1 or many) | Create requirements, invite-pool is system-decided (not manager-picked), recommend a winning bid, finalize below threshold | — |
| Chairman | Society | Approve/reject quotations (1 of 3 votes) | — |
| Secretary | Society | Approve/reject quotations (1 of 3 votes) | `manage_users` (default — this is the "Society Admin" function), `propose_threshold_change` |
| Treasurer | Society | Approve/reject quotations (1 of 3 votes) | `propose_threshold_change` |
| Bluejay Ops — Vendor Queue | Platform | Review/approve/reject vendor registrations, approve new-category requests | — |
| Bluejay Ops — Society Queue | Platform | Review/approve/reject society registrations | — |
| Bluejay Super Admin | Platform | Full access: both queues, taxonomy/city management, all directories | all |

**Important:** Permissions like `manage_users` and `propose_threshold_change` are **assignable flags**, not hardcoded to a role name, even though Secretary/Treasurer get them by default at onboarding. Build the permission check as "does this role-assignment have permission X," not "is this role literally 'Secretary'" — Bluejay may need to reassign these later without a code change.

---

## 5. Post-login routing

1. User authenticates.
2. System fetches all active Role Assignments for that user.
3. **If exactly one Role Assignment exists** → route directly into that context (e.g., straight into their one Vendor Company, or their one Society).
4. **If multiple exist** (e.g., a Manager linked to 5 societies) → show a context switcher ("Select Society") after login; user can switch context anytime from the app shell without logging out.
5. Within a context, the app shell renders the relevant module (Vendor / Society / Admin) and shows/hides screens and buttons based on that role assignment's permissions (e.g., "Manage Users" tab only appears if `manage_users` is true for the current context).
6. Platform (Bluejay) users don't have a "context" in the same sense — they go straight to the Admin module, scoped to their queue (Vendor Queue / Society Queue / Super Admin sees both).

---

## 6. Shared reference data (used by more than one module)

Build these as central/shared services, not duplicated per module:

- **Category taxonomy** (used by vendor registration, requirement creation, matching) — admin-managed, vendors can request additions
- **City list** (used by vendor service-area selection, society location, matching) — admin-managed
- **Notification service** (email + SMS) — triggered by events across all three modules, one shared sender

---

## 7. Cross-module data flow (how the pieces connect)

1. Society Manager creates a Requirement (Society module)
2. Matching engine selects eligible Active vendors by category + city (reads from Vendor module + shared taxonomy)
3. Selected vendors get notified, view requirement, submit structured bids (Vendor module)
4. Manager views bids once deadline closes, recommends one (Society module)
5. If above threshold: 2-of-3 OB approval triggered (Society module) → Work Order generated
6. If below threshold: Manager finalizes directly → Work Order generated
7. Winning + losing vendors notified (Vendor module)
8. Full record — requirement, all bids, approval trail — archived and searchable (Society module, visible to admin for oversight)

---

## 8. Permission-gated UI components (implementation checklist)

Every screen, tab, button, and in some cases individual field should be treated as gated by a permission check — the same check used on the backend for that action. Nothing should be gated purely by "which module am I in" or "what role does this user usually have."

**Pattern:** `if (currentRoleAssignment.permissions.includes(X)) { render component }` — where X is the same permission string the corresponding API endpoint checks. One source of truth, checked twice (UI hides it, API enforces it — never rely on the UI check alone).

Consolidated list of known gates (module-specific detail lives in each module's spec — this is the cross-reference):

| Component | Module | Gate | Visible to |
|---|---|---|---|
| Edit Company Profile / KYC | Vendor | `owner` role | Vendor Owner only |
| Manage Staff tab | Vendor | `manage_staff` | Vendor Owner |
| Submit/Edit Bid | Vendor | base role | Vendor Owner + Staff |
| Create Requirement | Society | `manager` role | Manager only |
| Approve/Reject Quotation buttons | Society | base role | Chairman, Secretary, Treasurer — **not** Manager |
| Manage Users tab | Society | `manage_users` | Secretary by default (flag-based, not name-based) |
| Propose Threshold Change | Society | `propose_threshold_change` | Secretary, Treasurer — **not** Manager, **not** Chairman |
| Approve Threshold Change | Society | base OB role, excluding proposer | Any OB other than the one who proposed |
| Finalize below-threshold selection | Society | `manager` role | Manager only |
| Vendor Approval Queue | Admin | Vendor Queue role | Bluejay Ops (Vendor) + Super Admin |
| Society Approval Queue | Admin | Society Queue role | Bluejay Ops (Society) + Super Admin |
| Taxonomy/City management | Admin | Super Admin role | Super Admin only |

**Dev note:** When building each screen, list every interactive component and its required permission *before* writing the component — treat this table as the seed, and extend it as new screens are designed. Don't build a screen assuming "the Manager's screen" or "the OB's screen" as fixed layouts; build one screen per workflow (e.g., one Requirement Detail screen) that conditionally renders its action buttons based on the viewer's permissions. This avoids duplicate screens per role and keeps behavior consistent if permissions are reassigned later.

---

## 9. Out of scope for v1 (platform-wide)

- Payments/invoicing/payout
- Automated anti-collusion analytics (manual review only in v1 — see Admin spec)
- Dispute resolution workflow
- Resident-facing access (only Manager + 3 Office Bearers have society-side login in v1 — general residents are not users of the platform yet; flag if this assumption is wrong)
- Configurable/editable permission sets via UI (permissions are correct-by-default at launch per the matrix above; a permission-editor screen is a later addition)
- WhatsApp notifications

---

*Companion documents: `CLAUDE.md` (project overview), `vendor-registration-portal-spec.md`, `society-portal-spec.md`, `admin-portal-spec.md`, `theme-and-design-system.md`, `landing-page-and-auth-flow-spec.md`, `work-order-pdf-spec.md`, `voice-to-job-ai-spec.md`*
