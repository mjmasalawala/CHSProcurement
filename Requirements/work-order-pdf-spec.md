# Work Order PDF — Feature Spec (v1 / MVP)
**Product:** Bluejay R&M Vendor Marketplace
**Status:** Draft for development kickoff — **contains one open question, see Section 1**

---

## 1. Scope assumption (please confirm)

The request was: *"a PDF for work orders which has the society details baked in and addressed to each vendor which is shortlisted."*

This doc assumes: **one Work Order PDF is generated per finalized Work Order**, dynamically addressed to whichever vendor won that specific selection — i.e., "addressed to each vendor" means the recipient details are templated per-instance (whoever the winning vendor happens to be), not that every invited/shortlisted vendor gets a copy of every Work Order.

**Alternate reading worth confirming:** you may also want a separate formal **RFQ/invitation letter** PDF sent to *all* invited vendors at the bidding stage (before a winner is chosen) — common in society procurement for paper-trail purposes. That would be a second, distinct document type. Flagging this now rather than assuming — let me know if it's needed for v1 or can wait.

The rest of this spec covers the Work Order PDF only.

---

## 2. Trigger

Auto-generated the moment a Work Order is created — i.e., immediately after:
- 2-of-3 Office Bearer approval finalizes a selection (at/above threshold), **or**
- Manager finalizes directly (below threshold)

See `society-portal-spec.md` Sections 7-8.

---

## 3. Document content

| Section | Content |
|---|---|
| **Header** | Society name, address, city (from Society profile). Society logo if one has been uploaded (schema supports this — see society spec Section 4.2, add if not already present). |
| **Document metadata** | Work Order Number (unique, auto-generated — suggest `WO-{society_id}-{sequential}` or similar), Date Issued |
| **Addressed to** | Winning vendor's company name, registered address, and contact (from Vendor profile) |
| **Reference** | Requirement category, description, Requirement ID (links back to the archive record) |
| **Scope of work** | Table of line items from the winning bid: description, quantity, unit, rate, amount (pulled directly from the Bid record — never re-typed) |
| **Total order value** | Auto-summed from line items |
| **Approval reference** | Either: "Approved by [Office Bearer names/roles], on [dates]" (at/above threshold path) or "Finalized by Manager [name] — below approval threshold" (below-threshold path) |
| **Manager's justification note** | Included if present (i.e., if the winning bid wasn't the lowest — see society spec Section 6) |
| **Terms/notes** | Any notes the vendor included with their bid |
| **Footer** | Generated-by-platform disclaimer, generation timestamp |

---

## 4. Distribution & access

- Automatically available for download from:
  - **Society Portal** — Requirement/Archive detail screen
  - **Vendor Portal** — that vendor's "My Bids / History" entry, once won
- Not emailed as an attachment automatically in v1 (the "Quotation finalized" notification links to the platform where it can be downloaded, rather than attaching the PDF to the email) — keeps notification payloads simple. Flag if email attachment is required instead of a link.

---

## 5. Implementation notes

- Reuse the typography/color tokens from `theme-and-design-system.md` so the PDF visually matches the platform (Arial/Calibri, dark-on-light).
- Recommended approach: server-side HTML-to-PDF rendering (template the document as HTML/CSS using the same design tokens, then render to PDF) rather than a code-first PDF-drawing library — easier to maintain and keep visually consistent with the web app as the design evolves.
- PDF should be stored (not just generated on-the-fly each time) so historical Work Orders remain retrievable exactly as issued, even if the society's profile details (address, logo) change later.

---

## 6. Explicitly out of scope for v1

- Digital signatures / e-signing
- Emailing the PDF as an attachment (link-based access only, per Section 4)
- RFQ/invitation letter PDF (see Section 1 — separate decision)
- Vendor-side acknowledgment/counter-signing workflow
