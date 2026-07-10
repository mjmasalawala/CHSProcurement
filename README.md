# CHSProcurement (ProSoc)

A single-URL SaaS platform solving the "three-quotation" R&M/CapEx procurement problem for housing societies in India. Societies raise requirements, the platform matches and invites eligible vendors, vendors submit blind structured bids, a co-approval workflow finalizes the winner, and the full process is archived for audit.

One application, not three — Vendor, Society, and Admin are role-gated sections of the same product (one login, one codebase, one backend API).

## Docs

- [`Requirements/`](Requirements/) — full product specs (start with `Requirements/CLAUDE.md`)
- [`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md) — build roadmap and milestones

## Stack

Next.js (TypeScript, App Router) + PostgreSQL + Prisma + NextAuth (Google + email/password). See `DEVELOPMENT_PLAN.md` for details and rationale.
