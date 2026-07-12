# Society Portal — Feature Spec (v1 / MVP)
**Product:** Housing Society R&M Vendor Marketplace (Bluejay)
**Module:** Society Portal — one module within the unified platform (see `unified-platform-architecture.md` for auth/roles model)
**Status:** Draft for development kickoff

---

## 1. Purpose

Allow a housing society (via its Manager and 3 Office Bearers) to raise R&M/CapEx requirements, receive system-matched vendor bids, approve and finalize a selection through a co-approval workflow, and maintain a searchable record of every transaction for future reference/audit.

---

## 2. Roles within this portal

| Role | Who | Core permissions |
|---|---|---|
| **Manager** | Society employee, or staff of an external management company (may manage multiple societies) | Create requirements, view bids once closed, recommend a winner, finalize directly if below approval threshold |
| **Chairman** | Elected office bearer, specific to this society | Approve/reject quotations (1 of 3 votes) + `propose_threshold_change` + `create_requirement` |
| **Secretary** | Elected office bearer, specific to this society | Approve/reject quotations (1 of 3 votes) + `manage_users` (default Society Admin function) + `propose_threshold_change` + `create_requirement` |
| **Treasurer** | Elected office bearer, specific to this society | Approve/reject quotations (1 of 3 votes) + `propose_threshold_change` + `create_requirement` |

- Office bearer roles are **specific to one society** — a Chairman of Society A is not automatically anything in Society B, even under the same management company.
- A **Manager** can be linked to multiple societies (one login, switch context — see architecture doc).
- Only these 4 roles have portal access in v1. General residents are not users of the platform.

---

## 3. Onboarding flow (hybrid: self-serve + admin approval)

1. Registrant (typically the Manager, but could be any office bearer) accesses a public society registration link.
2. Fills the Society Registration form (Section 4) — including **name, phone, and email of the person who will be the Secretary**, even if the registrant themselves isn't the Secretary.
3. Submit → status = **Pending Verification**. No requirements can be raised yet.
4. Bluejay (Society Approval Queue, Admin module) reviews and Approves or Rejects (with reason).
5. On approval:
   - The designated **Secretary** receives an activation invite → sets password/Google sign-in → automatically gets `manage_users` permission for this society.
   - The Secretary then logs in and invites the Manager (if not already the registrant), Chairman, and Treasurer, assigning each their role.
6. On rejection: registrant notified with reason, can edit and resubmit.

**Status states:** `Pending Verification` → `Active` | `Rejected` | `Suspended`

**Management company case:** If the registrant indicates they manage multiple societies, subsequent society registrations by the same Manager login are linked under one company-level view with a society switcher — each linked society still goes through its own independent approval and still has its own independent Secretary/Chairman/Treasurer.

---

## 4. Registration form — fields

### 4.1 GUI fields shown in v1 (Basic tier)

| Field | Type | Required? |
|---|---|---|
| Society Name | Text | Yes |
| Address | Text (multi-line) | Yes |
| City | Dropdown (shared city list) | Yes |
| Number of Units/Flats | Number | Yes |
| RWA/Society Registration Number | Text | Optional |
| Registrant Name & Role | Text + dropdown (Manager/Chairman/Secretary/Treasurer) | Yes |
| Registrant Phone & Email | Text | Yes |
| Secretary Name, Phone, Email | Text | Yes (even if registrant IS the Secretary, still captured explicitly) |

### 4.2 DB fields present but NOT in v1 GUI (Standard tier — build now, expose later)

- Society registration certificate (file upload + verification status)
- PAN (for future invoicing)
- Bank account details (for future payment features)
- Chairman/Treasurer contact details (currently added post-approval by Secretary, not at initial registration — schema should support capturing these earlier if the flow changes)

---

## 5. Requirement creation

| Field | Type | Required? |
|---|---|---|
| Project Name | Text | Yes |
| Category | Dropdown (shared taxonomy) | Yes |
| Description | Text area | Yes |
| Photos/attachments | File upload, multiple | Optional |
| Estimated Budget Band | Dropdown or range | Optional |
| Urgency | Dropdown (Routine / Urgent) | Yes |
| Bid Submission Deadline | Date/time | Yes |

- **Manager or any Office Bearer** (Chairman, Secretary, Treasurer — `create_requirement`; product decision 2026-07-12, originally Manager-only) can create a requirement. Bid comparison, recommendation, and below-threshold finalization remain Manager-only — creating a requirement doesn't grant those.
- On submit, system runs the matching engine (category + city match against Active vendors) and invites a pool of vendors automatically. **Nobody can hand-pick which vendors get invited** — this is a deliberate fairness control, not a gap. (See architecture doc, Section 7.)

---

## 6. Bid comparison & recommendation

- Bids remain **blind** (vendors can't see each other's) until the deadline closes.
- Once closed, Manager sees all submitted bids side-by-side (structured line items — see Vendor spec Section 8).
- Manager selects one bid as the **Recommendation**.
- If the recommended bid is **not** the lowest, the Manager must enter a short justification note (mandatory field) — this becomes part of the permanent record.

---

## 7. Approval workflow

- **Threshold:** default ₹1,000. Configurable per society.
- **Below threshold:** Manager's recommendation auto-finalizes immediately → Work Order generated. No OB approval needed, but the action is still logged.
- **At or above threshold:** Recommendation triggers approval requests to all 3 Office Bearers. **2 of 3 approvals** finalizes it → Work Order generated. A single rejection doesn't kill it outright, but if it becomes mathematically impossible to reach 2 approvals (i.e., 2 of 3 have rejected), the requirement is sent back to the Manager to re-recommend or re-open bidding.
- Every approval/rejection is timestamped and attributed to the specific office bearer — part of the audit trail.

### 7.1 Threshold change (co-approval pattern)

- Any Office Bearer with `propose_threshold_change` (Chairman, Secretary, or Treasurer — all 3 OB roles, per the permissions matrix; product decision 2026-07-12, originally Secretary/Treasurer only) can propose a new threshold value.
- Requires **one additional Office Bearer's approval** to take effect (i.e., 2-party sign-off, same pattern as quotation approval but simpler — 1 proposer + 1 approver, not 2-of-3).
- Logged: old value, new value, proposer, approver, timestamp.

**Dev note:** Build this as a generic "proposed change requires co-approval" mechanism rather than a one-off for the threshold field — you'll likely want the same pattern for other sensitive society settings later.

---

## 8. Work Order & archive

- On finalization (either path), system generates a **Work Order** record (vendor, bid details, approval trail or auto-finalize log, date).
- Winning and losing vendors notified automatically.
- **Full archive, searchable/filterable** by category, vendor, date, status:
  - Every Requirement raised
  - Every bid received (not just the winner)
  - Full approval trail (who approved/rejected, when, and the Manager's justification note if applicable)
  - Threshold change history
- This archive is the core "record-keeping" value proposition — build it as first-class, not an afterthought log table.

---

## 9. Notifications (v1)

Channels: Email + SMS.

Trigger events:
- Society registration submitted / approved / rejected
- Secretary activation invite
- New user invited by Secretary (role-specific welcome)
- Requirement's bid deadline approaching (to Manager)
- Bids ready for review (deadline closed)
- Approval requested (to each of the 3 OBs, when at/above threshold)
- Quotation finalized (to Manager + OBs)
- Requirement returned to Manager (2 rejections reached)
- Threshold change proposed (to other OBs) / approved

---

## 10. Explicitly out of scope for v1

- Resident-facing access/visibility
- Multi-level approval beyond the 2-of-3 OB model
- Dispute resolution workflow
- Payment/invoicing/payout
- Automated fairness/anomaly flagging (manual admin review only — see Admin spec)
- Editable permission assignments via UI (Secretary/Treasurer defaults are fixed at launch)

---

---

## 11. Permission-gated UI components (this module)

| Component | Gate | Manager | Chairman | Secretary | Treasurer |
|---|---|---|---|---|---|
| Create Requirement | `create_requirement` | ✅ | ✅ | ✅ | ✅ |
| Bid comparison view (post-deadline) | `manager` role | ✅ | ❌ | ❌ | ❌ |
| Recommend a winning bid | `manager` role | ✅ | ❌ | ❌ | ❌ |
| Finalize below-threshold selection | `manager` role | ✅ | ❌ | ❌ | ❌ |
| Approve/Reject Quotation (at/above threshold) | base OB role | ❌ | ✅ | ✅ | ✅ |
| Manage Users tab (invite/remove/reassign roles) | `manage_users` | ❌ | ❌ | ✅ (default) | ❌ |
| Propose Threshold Change | `propose_threshold_change` | ❌ | ✅ | ✅ | ✅ |
| Approve Threshold Change | base OB role, excluding proposer | ❌ | ✅ (if not proposer) | ✅ (if not proposer) | ✅ (if not proposer) |
| Requirement/Bid Archive (view) | base role, any assignment | ✅ | ✅ | ✅ | ✅ |

**Note:** Manager cannot approve or reject quotations — that's deliberately restricted to the 3 Office Bearers, keeping the person who *recommends* separate from the people who *approve*, which is the actual fairness control here (not just the 3-quote count). See `unified-platform-architecture.md` Section 8 for the platform-wide gating pattern.

---

*Companion documents: `unified-platform-architecture.md`, `vendor-registration-portal-spec.md`, `admin-portal-spec.md`*
