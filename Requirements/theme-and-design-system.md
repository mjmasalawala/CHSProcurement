# Theme & Design System — v1
**Product:** Bluejay R&M Vendor Marketplace
**Status:** Draft for development kickoff

---

## 1. Design principles

- **Clean and uncluttered.** One primary task per screen. Resist the urge to show everything a user *could* need — show what they need *right now*.
- **Light theme only for v1.** White/light backgrounds, dark text. No dark mode in scope.
- **Calm, not flashy.** This is a trust/compliance tool for housing society office bearers, most of whom are not tech-savvy. Avoid dense dashboards, heavy iconography, or dramatic color.
- **Forms are conversations, not paperwork.** Any multi-field data entry (registration, requirement creation) is a step-by-step wizard, not a long single-page form. See Section 4.

---

## 2. Typography

- **Font family:** Arial or Calibri (system fonts, no custom web font loading required — keeps the app fast and avoids licensing/loading overhead).
- **Suggested type scale:**

| Use | Size | Weight |
|---|---|---|
| Page title | 24px | Bold |
| Section heading | 18px | Semibold |
| Body text | 15px | Regular |
| Secondary/helper text | 13px | Regular, muted color |
| Button label | 15px | Semibold |

- Dark font color on light background throughout — no light-gray-on-white text that fails contrast checks. Target WCAG AA contrast minimum for all text.

---

## 3. Color palette (starting point — adjust to Bluejay brand guidelines when available)

| Token | Value (suggested) | Use |
|---|---|---|
| `background-primary` | `#FFFFFF` | Page background |
| `background-secondary` | `#F7F8FA` | Card/section backgrounds, subtle separation from page |
| `border-subtle` | `#E3E5E8` | Card borders, dividers |
| `text-primary` | `#1A1D23` | Headings, body text |
| `text-secondary` | `#5B6270` | Helper text, labels, timestamps |
| `accent-primary` | *(TBD — Bluejay brand color)* | Primary buttons, active states, links |
| `status-success` | `#2E7D32` (muted green) | Approved, Active, Won |
| `status-warning` | `#B26A00` (muted amber) | Pending, awaiting approval |
| `status-error` | `#B3261E` (muted red) | Rejected, expired |

**Note:** No accent/brand color has been specified yet — placeholder above. Confirm Bluejay's brand accent color before final implementation; everything else in this palette is accent-independent.

---

## 4. Wizard pattern (for all multi-field forms)

Applies to: Vendor Registration, Society Registration, Requirement Creation, and any future multi-field form.

**Structure:**
- Break the form into **logical steps of 2-4 fields each** — never more than ~4 inputs visible at once.
- Persistent **progress indicator** at the top (e.g., "Step 2 of 5") so the user always knows how much is left.
- Each step has a clear **single heading** describing what's being asked (e.g., "Where does your business operate?" rather than a generic "Step 2").
- **Back** and **Next** navigation on every step; **Next** is disabled until required fields on that step are valid.
- Final step is a **review screen** — summarizes everything entered, allows jumping back to edit any step, then a single **Submit**.
- Save progress between steps (don't lose data if the user closes the tab mid-wizard) — at minimum, hold state in the session; persisting a draft server-side is a nice-to-have, not required for v1.

**Example breakdown — Vendor Registration** (see vendor spec Section 4 for full field list):
1. Business basics (name, type, owner name)
2. Contact & login (email, phone, address)
3. What you do (service categories)
4. Where you work (cities + societies already serviced)
5. Review & submit

**Example breakdown — Requirement Creation** (see society spec Section 5):
1. What needs to be done (category, description, photos — or voice note, see `voice-to-job-ai-spec.md`)
2. How urgent, and budget expectation
3. Bid deadline
4. Review & submit

---

## 5. Layout conventions

- **Cards, not dense tables**, for anything the user needs to scan and understand (e.g., bid comparison should be a set of comparable cards per vendor, not a 15-column spreadsheet table).
- Tables are acceptable for pure lookup/reference lists (e.g., admin's approval queue list, archive search results) where scanning many rows is the actual task.
- Generous whitespace over compressed information density — this is a trust tool, not a trading terminal.
- Mobile-responsive: Managers and Office Bearers will very plausibly review and approve from a phone. Approval actions in particular must work cleanly on a small screen.

---

## 6. Explicitly out of scope for v1

- Dark mode
- Custom/branded font loading (Arial/Calibri only)
- Complex data-visualization/charting components (no analytics dashboards in v1 per the module specs)
