# Development Plan — Bluejay (CHSProcurement)

Status: v1 kickoff. Source of truth for scope is [`Requirements/`](Requirements/) — this plan sequences the build, it doesn't restate every field/rule from the specs.

---

## 1. Decisions on record

Flagged as open in the specs, resolved with the product owner on 2026-07-09:

| Question | Decision |
|---|---|
| Tech stack (not mandated in specs) | Next.js full-stack, TypeScript, single codebase/deploy |
| Work Order PDF scope | Work Order PDF only for v1 — no separate RFQ/invitation-letter PDF at bidding stage |
| Voice-to-Job AI language scope | **Hindi + English + Marathi** at launch (not English-only) — affects STT provider choice, see Section 3 |

Still open (not blocking early milestones, revisit before the relevant feature ships):
- Forgot-password flow detail (standard email-reset-link assumed)
- Audio retention policy for voice notes (exact duration TBD)
- Bluejay brand accent color (placeholder in design system)

---

## 2. Architecture summary

One Next.js app (App Router), role-based routing resolved post-login, one Postgres database, one set of API routes with server-side permission checks on every endpoint. See `Requirements/unified-platform-architecture.md` for the full model — the two things every milestone below must respect:

- **`users` + `role_assignments` tables**, not a `role` column on `users`. A `role_assignments` row = `(user_id, entity_type, entity_id, role, permissions[])`. This is what makes "one Manager, five Societies" and "Owner + Staff" work.
- **Permission checks are duplicated on purpose**: UI hides a control, API independently enforces the same permission string. Never gate an action in the frontend only.

## 3. Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router, TypeScript) | Single codebase/deploy, server components + API routes |
| Database | PostgreSQL | Prisma as ORM/migrations |
| Auth | NextAuth (Auth.js) | Google OAuth + email/password (bcrypt), custom invite-acceptance flow layered on top |
| File storage | S3-compatible bucket (e.g. Vercel Blob or S3) | KYC docs (schema-only for now), requirement photos, voice notes, generated PDFs |
| PDF generation | HTML/CSS template → PDF (e.g. Puppeteer/Playwright render), per the spec's recommendation | Matches theme tokens, stored not regenerated |
| Speech-to-text | TBD between OpenAI transcription models and Google Cloud Speech-to-Text | Must handle Hindi/English/Marathi incl. code-switching — validate both against real sample audio before committing, this is a build-time spike, not a guess |
| AI extraction (category/description) | LLM call (Claude or GPT) constrained to the fixed taxonomy | Structured output, "no confident match" fallback per spec |
| Notifications | Email (e.g. Resend/SES) + SMS (e.g. Twilio/MSG91) | Shared notification service, not duplicated per module |
| Hosting | Vercel (or equivalent) | Single deploy target |

## 4. Data model (initial entities)

Derived from the specs — will get exact Prisma schema as Milestone 1 output, not finalized here:

`User`, `RoleAssignment`, `VendorCompany`, `Society`, `Category` (taxonomy), `City`, `Requirement`, `Bid`, `BidLineItem`, `WorkOrder`, `ThresholdChangeProposal`, `CategoryRequest`, `Invite`, `Notification`.

Vendor and Society profile tables include the Section-4.2 "Standard tier" fields (KYC docs, bank details, etc.) as nullable columns from day one, per the specs' explicit instruction — no schema migration needed when those fields go live in the UI later.

---

## 5. Milestones

Sequenced so each milestone produces something demoable, and later milestones depend only on earlier ones.

### M0 — Scaffold
- Next.js + TypeScript project, Prisma + Postgres connected, base folder structure
- Design tokens from `theme-and-design-system.md` (colors, type scale) wired into a base UI kit (buttons, cards, form inputs, wizard shell component)
- CI-friendly lint/typecheck setup

### M1 — Auth & permission core
- `User` / `RoleAssignment` schema + migrations
- NextAuth: Google + email/password
- Permission-check utility used identically by API routes and UI (`hasPermission(roleAssignment, 'X')`)
- Post-login routing: single context → straight in; multiple contexts → context switcher (skeleton, no real data yet)
- This is the highest-leverage milestone — everything else gates through it. No module work starts until this is solid.

### M2 — Landing page + public registration + invite acceptance
- Public landing page (per `landing-page-and-auth-flow-spec.md`)
- Society Registration wizard (self-serve) → `Pending Verification`
- Vendor Registration wizard (self-serve) → `Pending Verification`
- Generic Invite Acceptance flow (parameterized, reused for Secretary/Manager/Chairman/Treasurer/Vendor Owner/Staff activation)
- Shared Category + City reference tables (admin-seedable, empty admin UI still pending until M3)

### M3 — Admin portal
- Vendor Approval Queue + Society Approval Queue (separate, per role)
- Category Request approval sub-queue
- Taxonomy + City management (Super Admin)
- Vendor Directory + Society Directory (search/drill-in)
- Aging indicators on both queues

*After M3, the onboarding loop is fully closed: register → approve → activate → log in.*

### M4 — Vendor portal
- Profile/KYC edit (Owner only)
- Staff management (invite/deactivate, activity log)
- Requirements Inbox
- Structured Bid Submission (line items, blind — no visibility into other vendors' bids)
- My Bids / History

### M5 — Society portal: requirement → bid → recommend
- Requirement Creation wizard (typed description path; voice path deferred to M8)
- Matching engine: category + city match against Active vendors, system-selected invite pool (Manager cannot hand-pick)
- Bid comparison view (post-deadline, card-based per the design system)
- Manager recommendation (+ mandatory justification note if not lowest bid)

### M6 — Approval workflow, threshold, Work Order, archive
- Below-threshold auto-finalize path
- At/above-threshold 2-of-3 Office Bearer approval path, timestamped/attributed
- Generic "proposed change requires co-approval" mechanism, applied first to threshold changes (Secretary/Treasurer propose, any other OB approves)
- Work Order generation on finalization
- Work Order PDF (HTML→PDF, stored not regenerated) — per Section 1 decision, Work Order only, no RFQ letter
- Full searchable archive (every requirement, every bid — not just winner, full approval trail)

*After M6, the core transaction loop is complete end-to-end and demoable society-side.*

### M7 — Notifications
- Shared notification service (email + SMS)
- Wire up every trigger event listed across the three module specs (registration submitted/approved/rejected, bid invites, deadline reminders, approval requests, finalization, threshold changes, staff invites, etc.)

### M8 — Voice-to-Job AI
- STT provider spike: validate Hindi/English/Marathi (incl. code-switching) quality before committing to a provider
- Audio record-in-browser / upload on Requirement Creation Step 1
- Transcription → LLM extraction (description + taxonomy-constrained category suggestion + urgency) → pre-fill wizard, mandatory human review before submit
- No-confident-match → routes into the same Category Request queue as vendor-side requests

### M9 — Polish & hardening
- Mobile-responsive pass, particularly OB approval actions (spec explicitly calls this out as needing to work cleanly on a phone)
- WCAG AA contrast pass
- Empty states, error states, loading states across all wizards and lists
- Basic oversight lists (Admin: requirements with <3 bids, vendors pending >X days)

---

## 6. Working agreement

- **Branching:** `main` is always deployable. Work happens on `develop` (or short-lived feature branches off it), merged via PR. I'll push commits as we build; you review/merge, or tell me to merge directly if you'd rather move fast.
- **Milestone = PR (or small PR series).** Each milestone above lands as one or a few reviewable PRs, not one giant diff.
- **New open questions get flagged inline, not silently assumed** — same rule the specs themselves use.
