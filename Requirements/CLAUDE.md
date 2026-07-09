# CLAUDE.md — Project Guide

This file orients Claude Code (or any developer) to the project before touching code. Read this first, then the companion docs referenced throughout.

---

## 1. What this is

A single-URL SaaS web application for **Bluejay**, solving the "three-quotation" R&M/CapEx procurement problem for housing societies in India: societies raise a requirement, the platform matches and invites eligible vendors, vendors submit blind structured bids, a co-approval workflow finalizes the winner, and the full process is archived for audit.

**It is one application, not three.** Vendor, Society, and Admin are role-gated sections of the same product — one login, one codebase, one backend API. See `unified-platform-architecture.md` for exactly how routing and permissions work.

---

## 2. Document index (read in this order)

1. **`unified-platform-architecture.md`** — auth model, entity/account structure, roles & permissions matrix, permission-gated UI pattern. Read this before writing any auth or permission code.
2. **`vendor-registration-portal-spec.md`** — Vendor module: registration, KYC fields, staff accounts, bidding.
3. **`society-portal-spec.md`** — Society module: onboarding, office bearer roles, requirement creation, approval workflow, threshold co-approval.
4. **`admin-portal-spec.md`** — Admin module: approval queues, taxonomy management, directories.
5. **`theme-and-design-system.md`** — typography, color, layout, and the wizard-form pattern used across all data-entry screens.
6. **`landing-page-and-auth-flow-spec.md`** — the public landing page, login-only auth entry (no public sign-up), and how invite-based account creation works.
7. **`work-order-pdf-spec.md`** — auto-generated Work Order PDF, triggered on finalization.
8. **`voice-to-job-ai-spec.md`** — voice-note-to-structured-requirement AI feature for Requirement creation.

---

## 3. Core entities (see architecture doc Section 3 for full detail)

- **User** — a login identity (Google or email+password). Separate from role.
- **Role Assignment** — links a User to a specific entity (a Vendor Company or a Society) with a role and permission set. A User can have multiple Role Assignments (e.g., a Manager across several Societies).
- **Vendor Company** — Owner + Staff.
- **Society** — Manager + Chairman + Secretary + Treasurer. Onboarded via self-serve + admin approval, same pattern as vendors.
- **Requirement** — raised by a Manager, category + description + deadline.
- **Bid** — structured line-items submitted by a vendor against a Requirement. Blind until deadline.
- **Work Order** — generated when a bid is finalized (via 2-of-3 OB approval, or auto-finalized below threshold).

---

## 4. Non-negotiable design principles (don't optimize these away)

- **Manager cannot hand-pick which vendors get invited to bid.** The matching engine decides the invite pool (category + city match against Active vendors). This is the platform's core fairness mechanism — see society spec Section 5 and architecture doc Section 7.
- **Manager recommends, Office Bearers approve.** These are separate people/permissions by design (society spec Section 11) — don't collapse this into one role for convenience.
- **Bids are blind until deadline.** No vendor should ever see another vendor's bid amount or even whether a competing bid exists, before the requirement closes.
- **Every permission gate applies at both the API layer and the UI layer**, using the same permission string. The UI hides a button; the API is what actually enforces it. Never gate an action in the frontend only.
- **Full archive is a first-class feature, not a log table.** Every requirement, every bid received (not just the winner), and the full approval trail must be searchable — this is a headline value proposition for the product, not an afterthought.

---

## 5. Stack notes

No stack has been mandated yet. Whatever is chosen, build to support:
- Server-side permission checks on every API endpoint (see Section 4 above)
- Server-side PDF generation (see `work-order-pdf-spec.md`)
- Audio upload + transcription + LLM call for the voice-to-job feature (see `voice-to-job-ai-spec.md`)
- Google OAuth + email/password auth, encrypted password storage

If you (Claude Code) are choosing the stack, flag the choice back to the product owner before committing to it — this file doesn't prescribe one.

---

## 6. Open product questions flagged across the specs (not yet decided)

These are called out inline in their respective docs — don't silently assume an answer, ask:
- Work Order PDF: confirm it's one PDF per finalized Work Order addressed to the winning vendor (current assumption), vs. also needing a formal RFQ/invitation letter sent to all invited vendors at the bidding stage.
- Voice-to-job AI: language scope for v1 (English-only assumed; confirm if Hindi/regional language support is needed at launch, not Phase 2).
