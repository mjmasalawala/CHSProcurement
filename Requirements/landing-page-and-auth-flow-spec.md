# Landing Page & Auth Flow — Feature Spec (v1 / MVP)
**Product:** Bluejay R&M Vendor Marketplace
**Status:** Draft for development kickoff

---

## 1. Key principle: there is no public sign-up page

Unlike most SaaS products, this platform has **no generic "Create Account" page**. Every account is created through one of two entry points:

1. **Society Registration** (self-serve form → admin approval → Secretary gets an activation invite) — see `society-portal-spec.md` Section 3.
2. **Vendor Registration** (self-serve form → admin approval → Owner gets an activation invite) — see `vendor-registration-portal-spec.md` Section 3.

Every other user on the platform (Manager, Chairman, Treasurer, Vendor Staff, Bluejay Ops staff) is **added by someone who already has an account** — Secretary invites Society-side users, Vendor Owner invites Staff, Bluejay provisions its own internal Admin users directly (not via the public site at all).

**Dev note:** The only two "public forms" on the entire site are Society Registration and Vendor Registration. Everything else is either Login or an Invite Acceptance flow (Section 4).

---

## 2. Landing page

Public, unauthenticated page — the product's front door.

**Layout:**
- **Top of page:** "Login" — links to the single platform login page (Section 3). No "Sign Up" button anywhere in the header.
- **Hero section:** Product intro — what the platform does, who it's for (societies and vendors), the core value prop (fair, transparent, system-matched quotations with full record-keeping).
- **How it works section:** Brief visual explainer of the requirement → match → bid → approve → archive flow.
- **Primary CTA:** "Register your Society" — prominent, mid-page and/or repeated near the bottom. Links to the Society Registration wizard.
- **Footer:** "Register as a Vendor" link — present but deliberately secondary/less prominent than the society CTA, since societies are the primary demand-side audience this marketing page is speaking to.

**Dev note:** Society registration is the primary conversion goal of this page; vendor registration is supply-side and can be reached but isn't the headline CTA. Reflect that in visual hierarchy, not just navigation placement.

---

## 3. Login page

- Single login page for the entire platform — every role (Vendor, Society, Admin) authenticates here.
- Two options: **Google Sign-In** or **Email + Password**.
- No "forgot password" flow detail specified yet — standard email-reset-link pattern assumed; flag if something different is needed.
- On success, routes per `unified-platform-architecture.md` Section 5 (single context → straight in; multiple contexts → context switcher).

---

## 4. Invite Acceptance flow (generic — reused across every invite type)

Since there's no public sign-up, every non-registrant user account is created in a **Pending** state when invited, and activated via a unique invite link. Build this as **one generic flow**, parameterized by what's being activated — not a separate flow per role.

**Used for:**
- Secretary activation (after society registration is approved)
- Manager / Chairman / Treasurer invited by the Secretary
- Vendor Owner activation (after vendor registration is approved)
- Vendor Staff invited by the Owner

**Flow:**
1. Invitee receives an email (and SMS, per the notification triggers in the module specs) with a unique, single-use, time-limited invite link.
2. Link opens a page confirming what they're accepting (e.g., "You've been invited as Treasurer for [Society Name]" or "Activate your Owner account for [Vendor Company Name]").
3. Invitee sets up login: Google Sign-In or Email + Password.
4. On completion, their pre-created Role Assignment (created in Pending state at invite time) flips to Active, and they're routed into the app per normal post-login routing.

**Edge cases to handle:**
- Expired invite link → clear message, option to request a new one (from whoever invited them, or a "resend" trigger admin/inviter can use).
- Invitee already has a platform account (e.g., a Manager who runs multiple societies gets invited to a new one) → skip credential setup, just attach the new Role Assignment to their existing User and route into the context switcher.

---

## 5. Explicitly out of scope for v1

- Self-service "forgot my role" or account recovery beyond standard password reset
- Public API/developer sign-up (not applicable to this product)
- Social login providers other than Google
