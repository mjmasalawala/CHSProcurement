# Wisesoc Messaging & Engagement Platform — Planning Spec

Status: DRAFT v2 for discussion, 2026-09-05 — incorporates round-2 amendments. No code written yet.

## 1. Where we are today

| Area | Current state |
|---|---|
| Email | Resend, ~27 `notify*` functions in `src/lib/notifications.ts`, one shared card template, fire-and-forget, no delivery log, no unsubscribe, no bounce handling |
| WhatsApp | Meta Cloud API direct (no BSP), OTP template only, stubbed until business verification completes |
| SMS | MSG91 for OTP only; everything else disabled (DLT cost). WhatsApp replaces SMS going forward |
| Scheduling | One hourly GitHub Actions cron hitting `/api/cron/deadline-reminders`; dedupe via two timestamp columns on `Requirement` |
| Hosting | Vercel Hobby (once-daily native crons, short function timeouts), Neon Postgres, Prisma |
| Preferences | None. No opt-in/opt-out anywhere |
| Inbound | None. No webhook, replies to WhatsApp go nowhere |
| AI | `@anthropic-ai/sdk` already a dependency (line-item suggestions) |

The important gap is structural, not channel-specific: every notification is a direct provider call from inside a server action. Adding WhatsApp to that pattern would double the number of ad-hoc calls and still leave you with no log, no scheduling, no preferences and no inbox.

## 2. Target architecture (one sentence)

Every outbound message becomes a row in an **outbox table**, created by either an application event, a scheduled rule, a drip sequence or a campaign; a single **dispatcher** sends the due rows through the right **channel adapter** (Resend / WhatsApp Cloud API) after checking preferences and limits; provider **webhooks** write delivery status and inbound replies back; an **admin messaging area** manages templates, campaigns, sequences, the inbox and analytics.

```
 App events ─┐
 Cron rules ─┤                       ┌─ Resend ──► email.* webhooks ─┐
 Sequences ──┼─► OUTBOX (Message) ─► DISPATCHER ─┤                             ├─► status / inbound
 Campaigns ──┘        ▲                ▲          └─ WhatsApp Cloud API ─► webhook ─┘
                      │                │                                        │
                 preferences      rate limits                              Conversation
                 quiet hours      quality rating                           + Inbox + AI triage
```

### 2.1 Components

1. **Template catalog (code-defined, typed).** One registry file listing every message key (e.g. `vendor.bid_deadline_24h`), its audience, channels it supports, required params, WhatsApp template name + category per language, and the email subject/body renderer. Code, not DB, so params are type-checked and reviewable in git. A small DB table mirrors WhatsApp template *approval status* per environment so the dispatcher can skip unapproved ones.
2. **Outbox (`Message` table).** Channel, template key, recipient (user / vendor company / society + resolved address), params JSON, `sendAfter`, status lifecycle (`QUEUED → SENDING → SENT → DELIVERED → READ`, or `FAILED` / `SKIPPED` with reason), `dedupeKey` (unique), provider message id, attempts, timestamps, optional `campaignId` / `sequenceEnrollmentId` / `conversationId`.
3. **Enqueue API.** `enqueue({ templateKey, to, params, channels, sendAfter?, dedupeKey })`. Existing `notify*` functions become thin wrappers over it, so call sites don't change. It returns the new row's id.
4. **Dispatcher — two entry points into the same send logic, not two systems.**
   - **`sendOne(messageId)`** — sends exactly that one row, nothing else. `enqueue()` for a transactional/urgent template (OTP, invite, password reset) calls `enqueue()` then immediately calls `sendOne(theNewId)` inside Next.js's `after()`, so the HTTP response isn't held up but the send starts within the same request's lifetime — typically under a second later. It never looks at the rest of the queue.
   - **`sweep()`** — the cron-triggered path. Queries for *all* rows where `status = QUEUED` and `sendAfter <= now`, claims a batch, and sends each one. This is what picks up reminders, sequence steps and campaign rows, i.e. everything nobody is actively waiting on.
   - Both paths funnel into the same `sendMessage(row)` function (gates → render → provider call → record result), so there's one place that enforces preferences, quiet hours and caps — `sendOne` isn't a way to bypass those, it's just a way to not wait for the next sweep.
   - Concretely: user clicks "resend OTP" → server action calls `enqueue()` → gets back a message id → calls `sendOne(id)` in `after()` → row is sent in ~1 second. Meanwhile a batch of 40 "quote deadline in 24h" reminders sitting in the queue is untouched until the next `sweep()` run, and `sendOne` never iterates over them at all — it was only ever given the one id it was called with.
5. **Channel adapters.** `email` (Resend, adds `List-Unsubscribe` and tracked links; marketing mail from a separate subdomain) and `whatsapp` (template sends, free-form sends inside the 24h window, media, quick-reply buttons, list messages).
6. **Webhook receivers.** `/api/webhooks/whatsapp` (verify token + `X-Hub-Signature-256`, handles `statuses` and `messages`) and `/api/webhooks/resend` (signed, handles `delivered / bounced / complained / opened / clicked`). Raw events stored in a `WebhookEvent` table first for idempotency and replay.
7. **Conversations + Inbox.** One `Conversation` per phone number (linked to User / VendorCompany when resolvable), `lastInboundAt` drives the 24h window indicator, status `OPEN / AI_HANDLING / NEEDS_HUMAN / CLOSED`, `assignedToUserId`. `InboundMessage` rows for every reply (text, button, list, media, location). Admin inbox UI: list, thread, reply box that switches to a template picker when the window is closed, assign, close, notes.
8. **Inbound triage — no LLM call for now, but built as a swappable interface (revised per your amendment).** You're right that a stateless Claude call on a single incoming message, with no real conversation memory or grounding, is exactly the setup where hallucination is most likely to embarrass you in front of a real customer. So for launch: **every inbound free-text message goes straight to `NEEDS_HUMAN` with zero AI involvement** — no Claude call happens at all. Only structured interactive replies (button/list taps) get auto-handled, exactly as before, because those are matched against a fixed enum in your own code, not interpreted by a model.
   - **Design for a future swap-in:** the webhook handler calls one function, `triageInbound(message, context) -> { action: "AUTO" | "NEEDS_HUMAN", autoResponse?, draftForHuman?, intent?, confidence? }`. Today's implementation of that function is a stub: it does no AI call and just returns `NEEDS_HUMAN` for anything that isn't a recognized button payload. Because the webhook/inbox/dispatcher only ever talk to this one function's interface, swapping the stub for a real classifier later — whether that's a properly trained/fine-tuned model, a RAG-grounded assistant with your FAQ and policy docs, or a Claude call with tightened guardrails once you trust it — is a change to one function, not to the inbox, webhook, or database schema.
   - **Still worth capturing now, for that future transition:** keep storing the full `InboundMessage` history (text, timestamps, who eventually handled it and how) and, once a human answers from the inbox, optionally tag *what the right response was* for that inbound. That reviewed history becomes your training/eval set later — you get evidence for the intents worth automating and real "correct answer" examples for each, rather than guessing. No AI is spent generating it, it's a side effect of your team just doing their job in the inbox.
   - When you do turn AI back on, plan on it drafting for human approval first (as I proposed originally) as a middle step, before trusting any auto-send beyond the button-driven cases — same reasoning as your admonition, an easy way to see how often it would have been wrong before letting it act unsupervised.
9. **Scheduled rules.** Generalise the deadline cron into a rules runner: each rule = a query for "who qualifies now" + template + dedupe key. Existing two reminders migrate; new ones added as rules (see catalog).
10. **Sequences (drips).** `Sequence` → ordered `SequenceStep` (delay, template, channel, stop-conditions) → `SequenceEnrollment` per contact. The runner enqueues the next step into the outbox. Used for vendor onboarding training, society onboarding training, re-engagement.
11. **Campaigns (broadcasts) — how a manual send works end to end.**
    1. In `/admin/messaging/campaigns/new`, you build an **audience filter** (role = Vendor, city = Pune, category = Waterproofing, status = Active, subscribed to Marketing, etc.) and see a live count of matching contacts as you adjust filters.
    2. You pick a **template** (already-approved WhatsApp template, and/or an email design) and channel(s).
    3. You can **send a test** to your own number/email to see exactly what recipients will get.
    4. You set a **schedule** (now, or a future date/time) and hit "Queue campaign".
    5. At send time, the campaign resolves its audience filter into a fixed recipient list (snapshotted, so it doesn't change mid-send even if someone's data changes) and creates one outbox `Message` row per recipient, tagged with `campaignId`.
    6. Those rows flow through the exact same dispatcher as everything else — so a campaign automatically respects opt-outs, quiet hours, the marketing frequency cap (≤4 WhatsApp/≤2 email per contact/week) and WhatsApp tier limits. If a contact is already at their cap that week, their row is `SKIPPED` with a logged reason rather than silently dropped or force-sent.
    7. The campaign detail page then shows live stats (sent/delivered/read/failed/replied/clicked) rolling up from those outbox rows.
    - In short: a campaign is just a bulk, human-triggered way of creating outbox rows — it doesn't bypass any of the machinery reminders or sequences use.
12. **Preferences & compliance.** See the expanded `ContactPreference` model in Section 6 (per-category subscriptions, message language). Opt-in captured at registration (checkbox with clear wording), via a WhatsApp reply button, and via a preference page. Inbound "Stop messages" / "Accept messages" buttons (Section 5, Inbound handling) auto-process without human involvement.
13. **Analytics.** Per template / campaign / sequence: sent, delivered, read, failed (by reason), replied, clicked (via `/r/<token>` redirect links), and downstream conversions (quote submitted within N hours of a reminder, requirement reviewed after nudge).

### 2.2 Build vs. buy for the inbox

| Option | Pros | Cons |
|---|---|---|
| **A. Build minimal inbox in the admin portal (recommended)** | You already own the number, webhook and admin portal; AI triage is straightforward with the SDK you have; conversation context (who is this vendor, what requirement) is right there; no per-agent fees | You write the UI (list + thread + reply, roughly 2–3 screens) |
| B. Chatwoot (open source / cloud) | Mature multi-agent inbox, WhatsApp Cloud channel built in | Meta allows one webhook URL per app, so either Chatwoot owns inbound and you relay to your app, or vice versa; you lose in-app context; separate hosting or $19+/agent |
| C. Indian BSP (Interakt, AiSensy, Wati, Gallabox) | Campaigns + inbox + template UI out of the box, cheap | They become the API owner; you would re-do the Cloud API work; less control, vendor lock-in, still need your own outbox for email and events |

Recommendation: A. Volume is B2B and modest; the value is in context-aware replies, which a generic inbox cannot give you. Revisit only if you need several external agents working shifts.

**Migration path if you outgrow it later:** yes, this is designed to be swappable, as long as we keep the boundary clean — `Conversation` / `InboundMessage` stay your own tables regardless of who's answering, and the webhook receiver is the only place that's provider-specific. Moving to Chatwoot or a BSP later means: (a) pointing Meta's webhook at the new tool instead of your route (only one URL is allowed at a time), (b) either accepting that tool's inbox as the new answer surface and having your app relay context to it via API/notes, or keeping your inbox and having it relay from the BSP — either way it's a webhook re-point plus an integration, not a rebuild of the outbox, templates, sequences or campaigns, which stay yours. The one thing to avoid now is baking Meta-specific payload shapes deep into business logic — keep them isolated in the `whatsapp` adapter and webhook receiver so swapping the provider touches two files, not the whole app.

### 2.3 Scheduling infrastructure

- Keep the DB outbox as the source of truth so the runner is replaceable.
- **Decision: stay on Vercel Hobby, GitHub Actions is free.** Runner: extend the existing `.github/workflows/deadline-reminders.yml` pattern (or fold into it) to hit `/api/cron/dispatch` every 5–10 min — GitHub's scheduler minimum is 5 min and timing is best-effort (can lag at busy times), which is fine since immediate/urgent sends never go through this path (they use `sendOne` + `after()`, Section 2.1 §4). There's nothing currently on Vercel's own cron config (`vercel.json` has no `crons` entry) — the one existing scheduled job is already on GitHub Actions, so there's no migration needed there, only extension.
- If volume grows enough that GitHub Actions' 5-minute floor becomes limiting, plug Upstash QStash (or Inngest) in as the trigger with delays; the outbox row remains the unit of work either way.

## 3. WhatsApp rules that shape the design (verify current numbers on Meta docs before launch)

- **Template categories:** Authentication, Utility, Marketing. Meta reviews category; onboarding tips / training content is almost always classified **Marketing**, reminders tied to a specific user action (your quote deadline, your requirement's quotes are ready) qualify as **Utility**.
- **Pricing (India, per-message since mid-2025):** Marketing ≈ ₹0.78, Utility ≈ ₹0.115, Authentication ≈ ₹0.115. Utility templates sent inside an open 24h customer-service window are free. Free-form replies inside the window are free.
- **24-hour customer-service window:** you may send free-form text only within 24h of the user's last inbound message; outside it, only approved templates. The inbox must show this and switch to template mode automatically.
- **Opt-in required** for business-initiated messages; Meta enforces per-user marketing limits and can pause templates or downgrade your quality rating if users block/report. Marketing frequency should be capped in your own dispatcher (suggest max 2 marketing messages per contact per week).
- **Messaging tier limits:** new numbers start around 250 business-initiated conversations / 24h (unverified) and 1,000 after business verification, scaling to 10k/100k with good quality. Dispatcher must respect the tier and roll over to the next day.
- **Templates need approval** (usually minutes to 48h). Draft the whole catalog now and submit as soon as the WABA is live.
- **Webhook:** one callback URL per Meta app; must answer GET verification challenge and validate the SHA-256 signature. Statuses: `sent`, `delivered`, `read`, `failed` (with error codes such as 131026 = not on WhatsApp, 131049/131050 = marketing limit/opt-out).
- **Interactive messages:** quick-reply buttons (up to 3) and list messages are strongly preferred over "reply YES" — they give structured inbound data your AI/inbox can act on directly.

### 3.1 What a WhatsApp template actually is, and why "HTML" doesn't apply

This came up re: bulk campaigns, so worth being explicit: **WhatsApp templates are plain text, not HTML.** There's no markup, no CSS, no layout — a template is closer to a fill-in-the-blank SMS than an email. What Meta reviews and needs, per template submission (via WhatsApp Manager in Meta Business Suite, or the Graph API's "Create Message Templates" endpoint):

- **Name** — internal identifier, e.g. `vendor_bid_deadline_24h_en`.
- **Category** — Marketing / Utility / Authentication. Meta may re-classify if it disagrees with what you picked.
- **Language** — one submission per language variant (English, Hindi, Marathi are three separate submissions, per your decision in Section 9.4).
- **Body** — the actual text, with numbered placeholders like `{{1}}`, `{{2}}` for the parts that vary per recipient (name, requirement title, deadline). Limited inline formatting only: `*bold*`, `_italic_`, `~strikethrough~`, `` `monospace` `` — no fonts, colors, tables, or images inside the body text itself.
- **Sample values for every placeholder** — mandatory. Meta's reviewers reject templates that don't show a realistic example (e.g. `{{1}}` → "Rahul", not "test" or "123"), since they're checking the template can't be twisted into spam/scam use once approved.
- **Optional header** — either a short text line (its own single placeholder allowed) or media: image, video, document, or location. This is as close as WhatsApp gets to "rich" — an image header, not styled HTML.
- **Optional footer** — one short line of fixed (non-parameterized) text, e.g. "Wisesoc — Society Procurement".
- **Optional buttons** — up to 3 quick-reply buttons, or call-to-action buttons (visit website / call phone number), fixed text, no placeholders.

So: **no, you cannot paste your existing HTML email design into a WhatsApp template** — the medium doesn't support it, independent of anything we build. Your existing `renderEmailHtml()` card template (`src/lib/notifications.ts`) keeps serving email as-is; a WhatsApp template for the same event is a separate, much shorter plain-text rendering of the same message, submitted and approved on its own.

## 4. Email rules that shape the design

- Split **transactional** (`notify@wisesoc.in` or current domain) from **marketing/training** (`updates.wisesoc.in`) so a spam complaint on a newsletter never hurts OTP deliverability.
- Every non-transactional email carries a one-click unsubscribe link and the `List-Unsubscribe` / `List-Unsubscribe-Post` headers (Gmail/Yahoo require this for bulk senders).
- Resend webhooks: `bounced` → mark address as suppressed; `complained` → auto-opt-out of marketing; `delivered / opened / clicked` → analytics.
- Consider `react-email` for richer training/newsletter layouts; the existing card template stays for transactional.

## 5. Message catalog (first cut)

Legend: E = email, W = WhatsApp. Category applies to the WhatsApp template.

### Transactional (already exist, migrate to outbox)
| Key | Audience | Channel | WA category | Trigger |
|---|---|---|---|---|
| auth.otp | any | W (E fallback) | Authentication | phone verification |
| auth.password_reset | any | E | — | user action |
| invite.society_member / vendor_staff | invitee | E + W | Utility | invite sent |
| registration.submitted / approved / rejected | registrant | E + W | Utility | admin action |
| vendor.matched_requirement | vendor | E + W | Utility | requirement published |
| society.approval_requested / finalized / returned | OB / manager | E + W | Utility | workflow |
| vendor.bid_outcome | vendor | E + W | Utility | finalization |
| vendor.category_request_decided, vendor.status_changed, threshold/member proposals | as today | E (+W where a phone exists) | Utility | admin / OB actions |

### Reminders (scheduled rules)
| Key | Audience | Channel | WA category | Rule |
|---|---|---|---|---|
| vendor.bid_deadline_48h / 24h / 4h | invited vendors without a bid | W (E for 24h) | Utility | existing 24h rule, extended |
| vendor.bid_draft_abandoned | vendor with a draft, no bid, deadline > 24h away | W | Utility | draft untouched 48h |
| society.deadline_approaching | manager | E + W | Utility | existing |
| society.quotes_ready | manager | E + W | Utility | existing |
| society.quotes_unreviewed_48h / 5d | manager, then OBs | W + E | Utility | closed, no recommendation |
| society.approval_pending_48h | OBs who haven't voted | W | Utility | pending approval |
| society.requirement_no_bids_at_close | manager | E + W | Utility | 0 bids at deadline, suggests extending |
| vendor.profile_incomplete | vendor | W | Marketing | missing categories/docs, **12h after approval** |
| vendor.inactive_30d | vendor with invites but no logins | W + E | Marketing | monthly |
| **vendor.suggested_not_registered** | vendor named in a `VendorSuggestion` who has never completed `VendorCompany` registration | W (E if only email given) | Utility | **12h after the society suggested them**, nudging them to finish registration so the society can actually raise a requirement to them; one-time (dedupe on the suggestion id), can layer a D3/D7 follow-up later if needed |

### Training / onboarding sequences
| Sequence | Steps (delay → content) | Channel |
|---|---|---|
| Vendor onboarding | D0 "welcome + how matching works" · D2 "using AI line-item suggestions" (short video link) · D4 "how to submit a winning quote" · D7 "complete your profile to get matched more" | W (link) + E (full content) |
| Society manager / OB onboarding | D0 "welcome + invite other OB members of your society" · D1 "post your first requirement in 5 min using AI" · D3 "reading quotes & recommending" · D5 "approval threshold & office bearers" · D15 "work orders" | W + E |
| Re-engagement | society with no requirement in 60 days: "here's what others are procuring" | E + W (Marketing) |

Office bearers no longer get a separate sequence — they're enrolled in the same "Society manager / OB onboarding" sequence as managers, since Office Bearer and Manager are both roles on the same society and the content (invite others, first requirement, quotes, approvals, work orders) is relevant to both.

### Broadcast campaigns (manual)
Product updates, new categories, seasonal (monsoon waterproofing, Diwali painting), webinar/training invites. Audience filters by role, city, category, activity. See Section 2.1 §11 for exactly how a campaign send works end to end.

### Inbound handling
| Inbound | Handling |
|---|---|
| Button: **"Stop messages"** | auto opt-out (scoped to what was offered — Marketing only, or all non-transactional, depending on the message it was attached to), confirmation reply sent, conversation closed |
| Button: **"Accept messages"** (opt-in) | auto opt-in, confirmation reply sent — this is the structured equivalent of the registration checkbox, usable e.g. in the WhatsApp opt-in backfill to existing users |
| Other button/list replies (e.g. "Remind me tomorrow", "Not interested", "Extend deadline") | structured actions, logged, auto-executed — safe because the payload is a fixed enum your code matches directly, not free text an LLM has to interpret |
| Any free-text message, including FAQ-shaped questions | **No AI call at launch.** Straight to `NEEDS_HUMAN` with the context card (who, role, active requirements/bids); agent replies from inbox using a template (if outside the 24h window) or free text (if inside it). See Section 2.1 §8 for the swappable `triageInbound()` design that lets this route to an AI draft later without touching the inbox/webhook. |

## 6. Data model sketch (Prisma, names indicative)

- `Message` (outbox) — described in 2.1 §2
- `MessageTemplateStatus` — templateKey, channel, language, providerTemplateName, status, category, lastSyncedAt
- `ContactPreference` — subject (userId | vendorCompanyId | societyId), phone, email, `messageLanguage` (EN / HI / MR — defaults to **Hindi for vendors, English for society users** per your amendment, editable by the contact), per-category subscription flags rather than one blanket marketing switch (e.g. `subscribedTraining`, `subscribedReminders` (Utility — on by default, since these are service messages tied to something the user is actually doing), `subscribedMarketing`, `subscribedCampaigns`), `whatsappOptInAt / OutAt`, `emailMarketingOptOutAt`, `emailSuppressedAt` (set by a Resend bounce/complaint), unsubscribeToken, consentSource. This is also where the WhatsApp "Accept/Stop messages" buttons and the `/preferences/<token>` page both write.
- `Conversation` — **`phoneE164`** is just the WhatsApp contact's phone number stored in the canonical international format WhatsApp's API itself uses: country code + number, digits only, no `+`, no leading `0` (e.g. Indian mobile `9000000000` → `919000000000`). `lib/whatsapp.ts`'s existing `toE164India()` helper already does this normalization for OTP sending — the same function becomes the single place that produces the value stored here, so a conversation is always found under one consistent key regardless of how the number was typed elsewhere in the app (with or without `+91`, spaces, dashes, etc.) — userId?, vendorCompanyId?, societyId?, status, assignedToUserId?, lastInboundAt, lastOutboundAt, aiSummary
- `InboundMessage` — conversationId, providerMessageId (unique), type, text, payload JSON, mediaUrl?, receivedAt, handledBy (AI | HUMAN | AUTO_RULE), intent?, confidence?
- `WebhookEvent` — provider, eventId (unique), payload, receivedAt, processedAt, error
- `Sequence`, `SequenceStep`, `SequenceEnrollment` (subject, currentStep, nextRunAt, status, stopReason)
- `Campaign`, `CampaignRecipient` (or just outbox rows tagged with campaignId + audience snapshot JSON on Campaign)
- `TrackedLink` — token, targetUrl, messageId, clicks
- `Requirement.deadlineReminderSentAt / deadlineClosedNotifiedAt` become redundant (dedupeKey on outbox replaces them); keep until migration is verified.

## 7. Admin UI (under /admin/messaging)

1. **Inbox** — conversations list (filters: needs human, assigned to me, open), thread view with context card (who, role, active requirements/bids), reply box with 24h-window indicator and template picker, AI draft button, assign/close, internal notes.
2. **Outbox / Logs** — searchable table of every message, status timeline, provider error, resend/retry, per-recipient history.
3. **Templates — yes, this page directly helps with Meta approval, not just tracking it.** Two things live here:
   - **Code-defined transactional/reminder templates** (Section 2.1 §1) — this page is read-only status tracking for those: name, category, language, current status (`PENDING` / `APPROVED` / `REJECTED` with Meta's rejection reason), synced from Meta via the template-status webhook event or a periodic API poll.
   - **New for ad hoc campaigns:** a "Create template" flow, since a one-off campaign wording is a new template every time (your observation) and switching out to Meta Business Suite each time would be friction. The form collects exactly the fields in Section 3.1 (name, category, language, body with `{{n}}` placeholders, sample values, optional header/footer/buttons) and — using the same Graph API access token as the sending adapter — calls Meta's Create Message Templates endpoint directly, so you never have to leave your own admin panel. The row is created locally as `PENDING`, then flips to `APPROVED`/`REJECTED` as Meta's webhook or the poll reports back, and only `APPROVED` templates are selectable when building a campaign in Section 2.1 §11.
   - **Live preview** of how the template will render on a phone, and "send test to me" once approved.
   - **Approval-time caveat this creates for campaigns:** unlike email (which needs no external approval and can go out the moment you write it), a brand-new WhatsApp campaign wording still has to clear Meta review first — typically minutes, occasionally up to 48h. So a WhatsApp campaign isn't instant-improvised the way an email one is; plan a small lead time, or default freshly-written campaigns to email-only until the WhatsApp template clears, then add WhatsApp once approved.
4. **Sequences** — steps editor (delay, template, stop conditions), enrollment stats, pause.
5. **Campaigns** — audience builder with live count, template, schedule, test send, results.
6. **Preferences** — search a contact, see consent history, manually opt in/out.
7. **Dashboard** — delivery/read/reply rates per channel, failures by reason, tier usage, quality rating, top intents.

Public/user-facing: `/preferences/<token>` (unsubscribe/manage), opt-in checkbox on registration forms, "Message us on WhatsApp" link (wa.me) on help pages.

## 8. Phased delivery

**Phase 0 — Foundation (can start now, no WhatsApp key needed)**
Outbox + dispatcher + template registry + preferences + Resend webhooks; wrap existing `notify*` calls; migrate the deadline cron to the rules runner; draft all WhatsApp template texts and submit them the moment the WABA is approved. Also: marketing email subdomain in Resend, unsubscribe page.

**Phase 1 — WhatsApp channel + inbound**
WhatsApp adapter (templates, free-form, buttons), webhook (statuses + inbound), Conversation/InboundMessage, "Stop messages"/"Accept messages" button handling, minimal inbox (list, thread, reply, template picker, assignment for a 3-person team), opt-in capture at registration. No backfill opt-in campaign needed — existing phone-verified users are already opted in (Section 9.6). Submit English/Hindi/Marathi templates for the whole catalog as early as possible in this phase, since approval can take up to 48h per template per language.

**Phase 2 — Reminders & training**
New reminder rules (deadline 48h/4h, unreviewed quotes, pending approvals, abandoned drafts), sequences engine, vendor + society onboarding sequences, training content pages on the site that messages link to, tracked links.

**Phase 3 — Campaigns, AI, analytics**
Campaign builder, AI intent classification + drafted replies + whitelisted auto-replies, dashboard, quality-rating monitoring and alerts to SUPPORT_EMAIL.

Rough sizing: Phase 0 ≈ 3–4 days, Phase 1 ≈ 4–5 days, Phase 2 ≈ 4–5 days, Phase 3 ≈ 5–7 days of focused work, sequential.

## 9. Decisions — resolved

1. **Hosting:** Stay on Vercel Hobby. GitHub Actions is free, so the dispatcher sweep runs there (Section 2.3). Nothing was actually on Vercel's native cron config to migrate — the one existing job is already GitHub Actions-based.
2. **Inbox:** Build in the admin portal for now. Confirmed migratable later to a BSP or Chatwoot (Section 2.2) provided the Meta-specific payload handling stays isolated to the `whatsapp` adapter and webhook receiver, and `Conversation`/`InboundMessage` remain your own tables rather than living inside a third-party tool.
3. **Team:** You plus 2 others answering WhatsApp. The inbox needs `assignedToUserId`, a "mine" filter, and a basic role (agent vs. admin) — already reflected in Section 7's Inbox UI; no separate ticketing/shift system needed at this scale.
4. **Languages:** English, Hindi, Marathi. Each is a separate WhatsApp template submission per message key (so the template catalog, Section 2.1 §1, is keyed by `(templateKey, language)`, not just `templateKey`). `ContactPreference.messageLanguage` (Section 6) drives which language variant the dispatcher sends, defaulting to **Hindi for vendors, English for society users**, editable per contact.
5. **Training content:** Links only (video/page/document hosted elsewhere — YouTube, Drive, your own site). No new content-hosting infrastructure needed; the template catalog and sequence steps just carry a URL param.
6. **Existing-user consent:** Existing phone-verified users are treated as opted in for **both Utility and Marketing** — no backfill opt-in campaign needed before Phase 1 launches messaging to them. (Still worth keeping the "Stop messages" button prominent from day one given the broader initial scope.)
7. **Sender persona:** "Wisesoc" (not "Team Wisesoc"). Marketing subdomain still to be named when you register it in Resend — suggest `updates.wisesoc.in` unless you prefer otherwise.
8. **Frequency caps:** ≤4 marketing WhatsApp messages and ≤2 marketing emails per contact per week; no cap on Utility/transactional messages.
9. **AI auto-send guardrails, revised:** No free-text reply is ever auto-sent, and — per your follow-up — **no AI call happens on free text at all for now**; it goes straight to a human, since a single stateless Claude call with no real conversation memory is exactly where hallucination risk is highest. Auto-execution stays restricted to structured interactive replies only — button/list taps such as opt-in, opt-out, and FAQ-link requests — matched by your code against a fixed enum. The inbound path is built behind one `triageInbound()` function (Section 2.1 §8) specifically so a real, properly trained/grounded classifier can be swapped in later without touching the webhook, inbox, or schema — and the human-handled history you're already logging becomes the training/eval data for that transition.
