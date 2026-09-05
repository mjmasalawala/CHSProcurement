# Outbound Communications Catalog

Every event in the app that sends an email and/or a WhatsApp message, as of 2026-09-05. Source of truth is [`src/lib/notifications.ts`](../src/lib/notifications.ts) (all email + WhatsApp sends) and [`src/lib/whatsapp.ts`](../src/lib/whatsapp.ts) (OTP). If you're asked "what do you send people," this file plus a `grep` against `notifications.ts` for the function name is the fastest way to answer accurately — don't rely on memory, regenerate this by re-reading the code, since it will drift as events get added.

All sends go through the outbox (`Message` table) described in [messaging-and-engagement-spec.md](messaging-and-engagement-spec.md) — every row here is logged, retried on failure, and (once the Resend/WhatsApp webhooks are registered) tracked through delivery/read status.

**Legend** — Channel: `E` = email, `W` = WhatsApp. Category: `TRANSACTIONAL` (always sent), `REMINDER` (always sent, time-triggered), `MARKETING` (subject to opt-out/frequency caps once Phase 2 builds those gates — see spec doc). WhatsApp only sends where explicitly marked `W`; everywhere else, WhatsApp doesn't fire even if the recipient has a phone on file (not yet wired for that event).

## Authentication & registration

| # | Event | Function | Channel | Category | Recipient | Trigger location |
|---|---|---|---|---|---|---|
| 1 | Phone verification code (invite acceptance) | `sendWhatsappOtp` (lib/whatsapp.ts) | W | Authentication | The invitee | `lib/phone-verification.ts` |
| 2 | Password reset requested | `sendPasswordReset` | E | Transactional | The account holder | `app/forgot-password/actions.ts` |
| 3 | New Society/Vendor registration submitted (internal alert) | `notifyNewRegistration` | E | Transactional | `SUPPORT_EMAIL` (Wisesoc team) | `app/register/society/actions.ts`, `app/register/vendor/actions.ts` |
| 4 | Registration submitted confirmation | `notifyRegistrationSubmitted` | E | Transactional | The registrant | `app/register/vendor/actions.ts`, `app/register/society/actions.ts` |
| 5 | Registration approved | `notifyApproval` | E | Transactional | The applicant (Vendor Owner, or Society) | `app/admin/vendors/[id]/actions.ts` |
| 6 | Registration rejected | `notifyRejection` | E | Transactional | The applicant | `app/admin/societies/[id]/actions.ts`, `app/admin/vendors/[id]/actions.ts` |
| 7 | Society approved — confirmation to the original registrant (when someone else got the activation invite) | `notifySocietyRegistrationApprovedToRegistrant` | E | Transactional | The person who submitted the registration | `app/admin/societies/[id]/actions.ts` |

## Invites & role activation

| # | Event | Function | Channel | Category | Recipient | Trigger location |
|---|---|---|---|---|---|---|
| 8 | Role activation invite (Manager/Chairman/Secretary/Treasurer/Vendor Staff, or society self-registration setup) | `sendInvite` | E | Transactional | The invitee | `lib/invite.ts` (`createInvite`/`resendInvite`) |
| 9 | Added using an existing account (fast-path, no password setup needed) | `notifyAddedToExistingAccount` | E | Transactional | The invitee | `lib/invite.ts` |

## Society "Suggest a Vendor" (the only event currently on both channels)

| # | Event | Function | Channel | Category | Recipient | Trigger location |
|---|---|---|---|---|---|---|
| 10 | Society suggests a vendor register / resend that suggestion | `notifyVendorSuggested` | **E + W** (W only if a phone number was given) | E: Transactional · W: **Marketing** (Meta-classified — see spec doc §3.1 history) | The suggested vendor | `app/society/[id]/suggest-vendor/actions.ts` (`suggestVendor`, `resendVendorSuggestion`), `app/admin/vendor-directory/actions.ts` (`resendVendorInvitation`), via shared `lib/vendor-suggestion.ts` |

Email and WhatsApp are sent independently here — one failing doesn't block the other (decoupled 2026-09-05).

## Society workflow (requirements, quotes, approvals)

| # | Event | Function | Channel | Category | Recipient | Trigger location |
|---|---|---|---|---|---|---|
| 11 | Quotation needs Office Bearer approval (at/above threshold) | `notifyApprovalRequested` | E | Transactional | Office Bearers | `app/society/[id]/requirements/[reqId]/actions.ts` |
| 12 | Quotation finalized / Work Order generated | `notifyFinalized` | E | Transactional | Office Bearers / Manager | `lib/work-order.ts` |
| 13 | Recommendation rejected, requirement returned to Manager | `notifyReturnedToManager` | E | Transactional | The Manager | `app/society/[id]/requirements/[reqId]/actions.ts` |
| 14 | Approval threshold change proposed | `notifyThresholdChangeProposed` | E | Transactional | Other Office Bearers | `app/society/[id]/settings/actions.ts` |
| 15 | Approval threshold change approved/rejected | `notifyThresholdChangeDecided` | E | Transactional | The proposer | `app/society/[id]/settings/actions.ts` |
| 16 | Member removal proposed | `notifyMemberRemovalProposed` | E | Transactional | Other Office Bearers | `app/society/[id]/members/actions.ts` |
| 17 | Member removal approved/rejected | `notifyMemberRemovalDecided` | E | Transactional | The proposer | `app/society/[id]/members/actions.ts` |
| 18 | Member removed (to the removed person) | `notifyMemberRemoved` | E | Transactional | The removed member | `app/society/[id]/members/actions.ts` |

## Vendor lifecycle

| # | Event | Function | Channel | Category | Recipient | Trigger location |
|---|---|---|---|---|---|---|
| 19 | New requirement matched to a vendor (invite to bid) | `notifyRequirementMatched` | E | Transactional | The matched vendor | `app/society/[id]/requirements/actions.ts`, `app/society/[id]/requirements/[reqId]/actions.ts` |
| 20 | Vendor newly matched to several requirements at once (approval, or profile edit widening match) | `notifyVendorMatchedRequirements` | E | Transactional | The vendor | `lib/matching.ts` |
| 21 | Category request approved/rejected | `notifyCategoryRequestDecided` | E | Transactional | The vendor | `app/admin/category-requests/actions.ts` |
| 22 | Bid outcome (selected / not selected) | `notifyBidOutcome` | E | Transactional | The bidding vendor | `lib/work-order.ts` |
| 23 | Vendor account suspended/reactivated | `notifyVendorStatusChanged` | E | Transactional | The vendor | `app/admin/vendors/[id]/actions.ts` |

## Time-based reminders (cron, not a user action)

Sent hourly by `/api/cron/deadline-reminders`, triggered by GitHub Actions (`.github/workflows/deadline-reminders.yml`) — each fires at most once per requirement (`deadlineReminderSentAt`/`deadlineClosedNotifiedAt` guards).

| # | Event | Function | Channel | Category | Recipient |
|---|---|---|---|---|---|
| 24 | Quote deadline closes within 24h (to Manager) | `notifyDeadlineApproaching` | E | Reminder | The Manager |
| 25 | Quote deadline closes within 24h, vendor hasn't bid yet | `notifyBidDeadlineReminder` | E | Reminder | Invited vendors without a submitted bid |
| 26 | Quote submission closed, quotes ready for review | `notifyBidsReadyForReview` | E | Reminder | The Manager |

## Internal / admin-only

| # | Event | Function | Channel | Category | Recipient | Trigger location |
|---|---|---|---|---|---|---|
| 27 | Contact Us form submitted | `notifyContactMessage` | E | Transactional | `SUPPORT_EMAIL` (Wisesoc team) | `app/contact/actions.ts` |

## Not currently sent (deliberately)

- **SMS** — wired up nowhere except OTP originally (now moved to WhatsApp); every other function has a commented-out `sendSms(...)` call left in place as a one-line re-enable if a DLT-registered template is ever approved (product decision, 2026-07-19). See the commented lines throughout `notifications.ts`.
- **WhatsApp** on any event other than #1 (OTP) and #10 (vendor suggested) — no other event has an approved WhatsApp template yet. Adding one requires: drafting the exact wording for approval (see the "never submit a template without approval" rule), submitting it to Meta, waiting for approval, adding an entry to `src/lib/messaging/whatsapp-templates.ts`, and wiring an `enqueueWhatsapp`/`sendWhatsapp` call into the relevant `notify*` function.

## How to regenerate this list

```bash
grep -n "^export async function" src/lib/notifications.ts
grep -rln "sendWhatsappOtp" src | grep -v generated
```
Then for each function name, `grep -rln "functionName(" src | grep -v notifications.ts` to find every call site (a function can be called from more than one place — e.g. `notifyRejection` fires from both the society and vendor admin-review actions).
