# Wisesoc Messaging & Engagement Platform — Planning Spec

Status: **Phase 0 shipped and live. Phase 1 (WhatsApp) substantially shipped and live in production as of 2026-09-06** — `WHATSAPP_MESSAGING_ENABLED=true` in production, two real events sending real WhatsApp messages to real people. Sections below are a mix of the original plan (still accurate for what's not built yet) and what actually happened once we built it — several assumptions in the original draft turned out to be wrong once tested against Meta's real behavior; those are called out explicitly rather than silently corrected, since the *reasons* they were wrong are themselves useful (Section 3 especially). Originally drafted 2026-09-05; this update 2026-09-06.

## 0. What's actually live right now (read this first)

- **Email** — every one of the ~27 `notify*` functions in `src/lib/notifications.ts` routes through the outbox (`Message` table), logged, retried on failure, with real delivery/bounce/complaint status via a registered Resend webhook. `RESEND_FROM_EMAIL` is a verified domain (`notify@wisesoc.in`); `updates.wisesoc.in` is also verified for future marketing use (Section 9.7). Real delivery to arbitrary recipients is unlocked — no more Resend sandbox restriction.
- **WhatsApp — two real events are live in production:**
  - `vendor.suggested` (Society "Suggest a Vendor" / "Resend Invite") — fires `wisesoc_vendor_suggested_v3` (Marketing) when a phone number is given.
  - `invite.role_activation` (Invite Member — Manager/Chairman/Secretary/Treasurer) — fires `wisesoc_role_invite_v3` (Marketing) whenever someone invites a new committee member; phone is now a **mandatory** field on that form specifically (unlike Suggest a Vendor's optional one), since it's the only way to reach someone who's never logged in.
  - **Vendor Staff invite is explicitly not wired yet** (deferred by product decision, tackle later the same way).
  - **OTP (`sendWhatsappOtp`) is built and its template is now mirrored on both WABAs, but it's still dead code** — `wisesoc_otp_code` (Authentication) was submitted to the production WABA on 2026-09-07 and approved instantly, matching the Test WABA's version exactly. What's still missing: `sendPhoneVerificationCode`/`verifyPhoneVerificationCode` (`lib/phone-verification.ts`) have zero call sites anywhere in the app — invite acceptance still bypasses phone verification entirely. The template being ready removes one of two gaps; wiring an actual call site is the other.
- **Two WhatsApp Business Accounts, not one** — a real, load-bearing discovery, see Section 3.2. Everything above is mirrored onto both.
- **Kill switches & safety nets, all real and tested, not just planned:** `WHATSAPP_MESSAGING_ENABLED` (per-environment, currently `true` in production, `false`/manual in staging), `STAGING_EMAIL_REDIRECT_TO`, `STAGING_WHATSAPP_REDIRECT_TO` (Section 2.1 §12a) — none of these were in the original plan below; they were built in response to real incidents (Resend's sandbox restriction disappearing once a domain verified, WhatsApp testing needing to never hit a real number).
- **The WhatsApp webhook is registered and live — but only for one environment at a time.** Meta allows exactly one callback URL per App, shared across every WABA connected to it (Section 3.3). It currently points at **production**; staging has no webhook coverage as a result. This was a real architectural constraint discovered in production, not anticipated in the original plan.
- **Not built yet:** the admin inbox UI, sequences, campaigns, the typed per-language template catalog described in Section 2.1 §1 (superseded by the simpler environment-aware registry actually built — Section 3.2), Hindi/Marathi templates, and Marketing frequency caps (Section 9.8's ≤4/week figure is still just a plan, not enforced in code — Meta's own pacing throttle, error 131049, is the only thing limiting frequency today, and it fails silently rather than gracefully — see Section 3.4).

## 1. Where we are today (original, pre-build — kept for context)

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

The important gap is structural, not channel-specific: every notification is a direct provider call from inside a server action. Adding WhatsApp to that pattern would double the number of ad-hoc calls and still leave you with no log, no scheduling, no preferences and no inbox. **This is exactly what got built — see Section 0.**

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

1. **Template catalog (code-defined, typed) — built simpler than planned, and it's enough.** `src/lib/messaging/whatsapp-templates.ts` maps a `templateKey` to `{ test, production? }`, each an approved Meta template `{ name, language }` — no DB table, no per-language dimension yet (only English exists today). `getWhatsappTemplate(templateKey)` picks `test` or `production` based on `isStagingEnvironment()` (Section 3.2) and returns `undefined` if that environment's WABA doesn't have this template yet, which the dispatcher treats as "not ready, SKIP" rather than guessing. The email side never needed a registry at all — `notify*` functions just call `sendEmail()` directly with inline content, tagged with a stable `templateKey` string purely for outbox logging/analytics (see `Requirements/outbound-communications-catalog.md` for the full list). If Hindi/Marathi ever get added, this file's shape needs to grow to `{ test: Record<language, TemplateRef>, production?: ... }` — not built yet.
2. **Outbox (`Message` table).** Channel, template key, recipient (user / vendor company / society + resolved address), params JSON, `sendAfter`, status lifecycle (`QUEUED → SENDING → SENT → DELIVERED → READ`, or `FAILED` / `SKIPPED` with reason), `dedupeKey` (unique), provider message id, attempts, timestamps, optional `campaignId` / `sequenceEnrollmentId` / `conversationId`.
3. **Enqueue API.** `enqueue({ templateKey, to, params, channels, sendAfter?, dedupeKey })`. Existing `notify*` functions become thin wrappers over it, so call sites don't change. It returns the new row's id.
4. **Dispatcher — two entry points into the same send logic, not two systems.**
   - **`sendOne(messageId)`** — sends exactly that one row, nothing else. `enqueue()` for a transactional/urgent template (OTP, invite, password reset) calls `enqueue()` then immediately calls `sendOne(theNewId)` inside Next.js's `after()`, so the HTTP response isn't held up but the send starts within the same request's lifetime — typically under a second later. It never looks at the rest of the queue.
   - **`sweep()`** — the cron-triggered path. Queries for *all* rows where `status = QUEUED` and `sendAfter <= now`, claims a batch, and sends each one. This is what picks up reminders, sequence steps and campaign rows, i.e. everything nobody is actively waiting on.
   - Both paths funnel into the same `sendMessage(row)` function (gates → render → provider call → record result), so there's one place that enforces preferences, quiet hours and caps — `sendOne` isn't a way to bypass those, it's just a way to not wait for the next sweep.
   - Concretely: user clicks "resend OTP" → server action calls `enqueue()` → gets back a message id → calls `sendOne(id)` in `after()` → row is sent in ~1 second. Meanwhile a batch of 40 "quote deadline in 24h" reminders sitting in the queue is untouched until the next `sweep()` run, and `sendOne` never iterates over them at all — it was only ever given the one id it was called with.
5. **Channel adapters.** `email` (Resend, adds `List-Unsubscribe` and tracked links; marketing mail from a separate subdomain) and `whatsapp` (template sends, free-form sends inside the 24h window, media, quick-reply buttons, list messages).
6. **Webhook receivers — built and both registered for real.** `/api/webhooks/whatsapp` (GET verification challenge against `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, POST verifies `X-Hub-Signature-256` — plain HMAC-SHA256 over the raw body with `WHATSAPP_APP_SECRET`, hex-encoded, *not* the Svix scheme Resend uses) and `/api/webhooks/resend` (Svix-signed, handles `delivered / bounced / complained / opened`; `clicked` isn't acted on since `TrackedLink`/`/r/<token>` redirects don't exist yet). Every event is stored in `WebhookEvent` first (`@@unique([provider, eventId])`) so a retried delivery — both providers retry on a non-2xx response — is a no-op instead of double-processed. **Registered against real infrastructure, not just built:** the app-level WhatsApp webhook subscription (`POST /{app_id}/subscriptions`) and the WABA-level subscription (`POST /{waba_id}/subscribed_apps`) are both live Graph API calls, not just code — see Section 3.3 for why only one environment can have this at a time.
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
12a. **Kill switches and staging safety nets — not in the original plan, built in response to real incidents.**
    - **`WHATSAPP_MESSAGING_ENABLED`** (Section 9.9 onward) — gates every non-OTP WhatsApp send, checked inside `sendWhatsappTemplate`/`sendWhatsappText` themselves (not just at call sites) so a future careless caller can't bypass it. Deliberately *not* removed once staging redirects existed (Section "why keep both" below) — it's the one deliberate flip that makes "deploy" and "go live" two different moments. Currently `true` in production, `false` in staging.
    - **`STAGING_EMAIL_REDIRECT_TO` / `STAGING_WHATSAPP_REDIRECT_TO`** — mirror each other. Neither existed in the original plan because Resend's sandbox mode (delivers only to the account owner's own address) and WhatsApp's test-number allowlist used to make staging harmless by accident. Once `RESEND_FROM_EMAIL` became a verified domain, that protection silently disappeared for email — realized only after testing showed staging emails reaching arbitrary real addresses. The fix: every outbound send in staging (`isStagingEnvironment()`, Section 3.2) is redirected to one configured address/number regardless of the real recipient, and if that redirect target isn't configured, the send is refused outright rather than guessing. `STAGING_WHATSAPP_REDIRECT_TO` also covers OTP, for defense in depth, even though Vercel Deployment Protection (see Section 9, "Staging access") independently blocks external traffic from ever reaching staging today.
    - **Why keep the kill switch even with the staging redirect covering staging's own risk:** they protect against different things. The redirect stops staging from ever messaging a real person. The kill switch is a deliberate production go-live gate, independent of when code merges/deploys — without it, shipping code to `main` would itself be the moment real sends start, with no separate decision point. Both exist; neither is redundant with the other.
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

## 3. WhatsApp rules that shape the design (updated 2026-09-06 with real, tested findings — not just docs)

- **Template categories:** Authentication, Utility, Marketing. See Section 3.1a below — **"tied to a specific user action" is not sufficient for Utility**, and this bit us repeatedly before we understood why.
- **Pricing (India, per-message since mid-2025):** Marketing ≈ ₹0.78, Utility ≈ ₹0.115, Authentication ≈ ₹0.115. Utility templates sent inside an open 24h customer-service window are free. Free-form replies inside the window are free.
- **24-hour customer-service window:** you may send free-form text only within 24h of the user's last inbound message; outside it, only approved templates. The inbox must show this and switch to template mode automatically. **Built exactly as planned** — `dispatcher.ts` checks `Conversation.lastInboundAt` and falls back to a template outside the window.
- **Opt-in required** for business-initiated messages; Meta enforces per-user marketing limits and can pause templates or downgrade your quality rating if users block/report. Marketing frequency should be capped in your own dispatcher (suggest max 2 marketing messages per contact per week) — **still not built**; see Section 3.4, this is a real live gap right now.
- **Messaging tier limits:** new numbers start around 250 business-initiated conversations / 24h (unverified) and 1,000 after business verification, scaling to 10k/100k with good quality. Dispatcher must respect the tier and roll over to the next day. **Not enforced in code** — untested at real volume so far.
- **Templates need approval** (usually minutes to 48h, though we've seen Authentication-category templates approve near-instantly and Marketing/Utility ones clear anywhere from minutes to over an hour). Draft the whole catalog now and submit as soon as the WABA is live.
- **Webhook:** one callback URL per Meta app; must answer GET verification challenge and validate the signature. **Confirmed for real, and it's a sharper constraint than "one URL" suggests** — see Section 3.3. Statuses: `sent`, `delivered`, `read`, `failed` (with error codes such as 131026 = not on WhatsApp, 131049 = **Marketing pacing/"ecosystem engagement" throttle, seen for real** — Section 3.4).
- **Interactive messages:** quick-reply buttons (up to 3) and list messages are strongly preferred over "reply YES" — they give structured inbound data your AI/inbox can act on directly. Not yet used for anything beyond the two fixed opt-in/opt-out button ids in `inbound-triage.ts` — no outbound interactive/button message has actually been sent yet, only URL buttons on templates.

### 3.1a Utility vs. Marketing — what actually determines it (researched + tested, 2026-09-06)

Three separate template submissions (`vendor.suggested`'s v1–v3, `invite.role_activation`'s v1–v3) all converged on the same outcome regardless of wording, which prompted real research rather than more guessing. The finding, confirmed against Meta's own documentation:

**The deciding factor is whether the message continues an existing relationship or initiates a new one — not tone, not specific words.** Meta's own docs define Utility as content "specific to or requested by the user," tied to an order, account, service, or transaction *the user already has*. Marketing explicitly includes messages that "build customer relationships... by prompting new conversations" — i.e., reaching someone who doesn't have an established transactional relationship with you yet, however neutrally it's worded.

This means:
- **"You've been invited to register" and "you've been granted access" are structurally Marketing**, full stop, regardless of wording — the recipient hasn't done anything yet; someone else acted on their behalf, or they're a stranger to the platform. No amount of rewording moved either template off Marketing once it reached final review, including versions that briefly showed Utility mid-review before being reclassified.
- **OTP-shaped content (a verification code) must be Authentication, never Utility** — submitting a code-delivery template as Utility gets an instant `INCORRECT_CATEGORY` rejection, the one case where the rejection is immediate rather than a post-approval reclassification. This also means any wording that merely *resembles* authentication content (we hit this with `password`/`activate` language in a non-OTP template) can trigger the same instant rejection even outside a true OTP flow — Meta's classifier reads specific words, not just intent, for this one case.
- **A persuasive button can disqualify an otherwise-neutral message on its own** — a neutral body with a "Shop Now"-style button is still Marketing. Our buttons ("Create your password," "Register on Wisesoc") are reasonably neutral/functional, so buttons weren't the deciding factor in our case — the underlying content type was.
- **What reliably stays Utility, per research and consistent with our own reminder-style messages that were never actually tested against this** (`society.deadline_approaching`, `vendor.bid_deadline_reminder`, etc., in Section 5): content tied to something the recipient **already started or has** — an order they placed, a bid they submitted, a registration they began, a deadline on a requirement they're already part of. The distinguishing question for any *new* WhatsApp event: is this servicing something the recipient already has, or introducing them to something new? That predicts the category far better than how carefully the wording is chosen.
- **Category can't be changed via edit on an approved template** — Meta's edit endpoint (`POST /{template_id}`) rejects any attempt to change `category` on an already-approved template (`"Cannot update an approved template category"`). Getting a different category always means a new template name, never an edit — this is why `_v2`/`_v3` naming exists rather than in-place fixes, and why the earlier "test first, mirror the final version to production, never simultaneously" policy (Section 3.2) matters: iterating live against production would leave orphaned reclassified drafts cluttering the real number's history.
- **A template body variable can't be the first or last token** — "Variables can't be at the start or end of the template" is a real, enforced submission-time rule, not a style preference. Hit this once (`Hello {{1}} — ...`), fixed by leading with static text.
- **A template can only be edited once per 24 hours** — a real, enforced rate limit on the edit endpoint specifically (`POST /{template_id}`), unrelated to review time. This is why a wording fix sometimes has to become a new template name rather than a quick edit — waiting out the window isn't always practical.
- **Appeals exist (60 days, via WhatsApp Manager → Business Support Home) but are unlikely to help this specific content type** — appeals are for genuine false-positive keyword flags on transactional content, not for content Meta's definition explicitly excludes from Utility. Not attempted, on the reasoning above.

### 3.2 Two WhatsApp Business Accounts, not one (discovered 2026-09-06, now a permanent architecture decision)

The WABA used throughout initial development (`1634552898092020`) turned out to be a Meta-provisioned **Test WhatsApp Business Account** — confirmed via `GET /{waba_id}` returning `"name": "Test WhatsApp Business Account"` — sitting alongside a separate, genuinely real WABA (`4358290911100089`, named plainly "Wisesoc") under the same Business Manager. Rather than treat this as a one-time migration (swap the test WABA for the real one), it became the permanent workflow:

- **Test WABA → staging.** All experimentation, wording iteration, rejected drafts happen here. Never affects the real number's template history, quality rating, or messaging-tier consumption.
- **Production WABA ("Wisesoc") → production.** Only a template that's *already confirmed working* on the Test WABA gets mirrored here, with identical content — never submitted simultaneously with the test attempt, and never before the wording has settled. This is deliberate: submitting every draft to both would have left the real number's template list cluttered with the same rejected/reclassified attempts test iteration produced.
- **`getWhatsappTemplate()` in `whatsapp-templates.ts`** picks the right WABA's template name automatically based on `isStagingEnvironment()` — the same environment check that drives the staging banner, `robots.txt`, and the staging redirects above. A templateKey with no entry for the *current* environment's WABA is treated as "not ready there," not a fallback to the other one.
- **Credentials are fully separate per environment** — separate System Users, separate permanent access tokens, separate `WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_BUSINESS_ACCOUNT_ID` per Vercel environment. Setting up the production System User hit the same "assign an app role, not just the WABA asset" permission gotcha the test one did — Business Settings → Accounts → WhatsApp Accounts (the asset) and Business Settings → Accounts → Apps (the app role) are two separate grants, both required.
- **The real business phone number was already verified before we knew to look** — `+91 73852 22852`, `code_verification_status: "VERIFIED"`, sitting on the production WABA the whole time. The "swap test number for real number" gate tracked earlier in this project turned out to already be done; nobody realized because nothing had been pointed at it yet.

### 3.3 One webhook URL per Meta App — sharper than it sounds, and now a real tradeoff being lived with

The "one callback URL per app" rule isn't just about the two WABAs sharing a URL — it means **only one environment can have live webhook coverage at a time**, full stop, because both WABAs (test and production) are connected through the same single Meta App. Subscribing a WABA to the app's webhook doesn't give it its own URL; it just opts that WABA's events into the one shared pipe.

Consequence lived through for real: the webhook was first registered against staging (`https://staging.wisesoc.in/api/webhooks/whatsapp`) to debug why a message wasn't arriving (see Section 3.4) — which required temporarily **removing Vercel Deployment Protection from staging**, since Meta's verification handshake can't get past an auth wall. Once production went live with real sends, the webhook was re-pointed at production (`https://www.wisesoc.in/api/webhooks/whatsapp`) instead, since honoring real opt-outs and seeing real delivery failures matters more than staging's own debugging convenience. Staging currently has **no webhook coverage** as a result — any future debugging session against the Test WABA needs either a temporary re-point (losing production coverage for that window) or a dedicated second Meta App for staging (not built; real setup cost — its own System User, app secret, permission grants).

**Staging Deployment Protection was not restored after this** — `staging.wisesoc.in` is publicly reachable by anyone with the URL as of 2026-09-06. `robots.txt`'s staging-wide `Disallow: /` (Section on staging safety, built earlier) still discourages well-behaved crawlers, but it was never a security boundary and isn't one now — don't assume staging is access-gated without checking.

### 3.4 Meta's own Marketing pacing throttle — a real failure mode, seen and diagnosed

A `wisesoc_role_invite_v3` send returned `"message_status": "accepted"` from the Graph API — a real message ID, looking completely successful — but never arrived. With no webhook registered at the time, this was undiagnosable until the webhook above was stood up specifically to solve it. The real status, once visible: `failed`, error code **131049**, `"This message was not delivered to maintain healthy ecosystem engagement."` — Meta's own anti-spam pacing throttle for Marketing-category messages, triggered by sending many Marketing templates to the same test number in a short window during development.

Two takeaways: (1) **`"accepted"` from the send API is not a delivery confirmation** — only the webhook's `statuses` field tells you what actually happened, which is exactly why the webhook matters operationally, not just architecturally; (2) since both live WhatsApp events (`vendor.suggested`, `invite.role_activation`) are Marketing-classified (Section 3.1a), this throttle is a real, live constraint on production sending volume per recipient, separate from and in addition to whatever frequency cap we eventually build ourselves (Section 9.8) — it's Meta's ceiling, not just ours, and it fails silently at the API level.

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
| auth.otp | any | W (E fallback) | Authentication | phone verification — **template approved on both WABAs now (`wisesoc_otp_code`, since 2026-09-07); still dead code, no call site wired up (Section 0)** |
| auth.password_reset | any | E | — | user action — **live**, email-only, no WhatsApp variant built |
| invite.society_member (Manager/Chairman/Secretary/Treasurer) | invitee | E + W | ~~Utility~~ **Marketing, confirmed live** | invite sent — **live as `invite.role_activation` → `wisesoc_role_invite_v3`**; phone is now mandatory on this specific form (Section 0). Originally assumed Utility here — see Section 3.1a for why an invite to someone with no prior account can never actually land as Utility. |
| invite.vendor_staff | invitee | E + W | Marketing (by the same 3.1a logic, untested) | invite sent — **not built**, deferred by product decision ("we will tackle later") |
| vendor.suggested | prospective vendor | E + W | ~~Utility~~ **Marketing, confirmed live** | society names a vendor it wants — **live** as `vendor.suggested` → `wisesoc_vendor_suggested_v3`, phone optional on this form (unlike role invites) |
| registration.submitted / approved / rejected | registrant | E + W | Utility (untested against 3.1a — registrant already has an account/application in progress, so likely correct as-is) | admin action — **email-only today**, WhatsApp variant not built |
| vendor.matched_requirement | vendor | E + W | Utility (untested against 3.1a — vendor already has an active company/relationship, likely correct) | requirement published — **email-only today**, WhatsApp variant not built |
| society.approval_requested / finalized / returned | OB / manager | E + W | Utility (untested, likely correct — same reasoning) | workflow — **email-only today** |
| vendor.bid_outcome | vendor | E + W | Utility (untested, likely correct) | finalization — **email-only today** |
| vendor.category_request_decided, vendor.status_changed, threshold/member proposals | as today | E (+W where a phone exists) | Utility (untested) | admin / OB actions — **email-only today** |

**Note on the "Utility (untested)" rows above:** none of these have actually been submitted to Meta yet, so "Utility" is still a prediction, not a confirmed outcome — but per Section 3.1a's finding (existing relationship/transaction = Utility, new relationship = Marketing), these should hold up better than the two invite-shaped events did, since every recipient here already has an active account and an in-progress thing (an application, a company, a requirement, a bid) rather than being introduced to the platform cold. Confirm each on the Test WABA before assuming it.

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
| vendor.profile_incomplete | vendor | W | Marketing | missing categories/docs, **12h after approval** — **not built yet, but the Marketing call here already looks right per Section 3.1a** (nudging toward more platform engagement, not servicing an existing transaction) |
| vendor.inactive_30d | vendor with invites but no logins | W + E | Marketing | monthly — **not built** |
| **vendor.suggested_not_registered** | vendor named in a `VendorSuggestion` who has never completed `VendorCompany` registration | W (E if only email given) | ~~Utility~~ **likely Marketing, not built yet** | **12h after the society suggested them**, nudging them to finish registration so the society can actually raise a requirement to them; one-time (dedupe on the suggestion id), can layer a D3/D7 follow-up later if needed. Flagged as suspect because it's the same "recipient has no account yet" shape as `invite.role_activation`, which landed Marketing regardless of wording (Section 3.1a) — assume Marketing until actually submitted and proven otherwise. |

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

**Phase 0 — Foundation — DONE, live in production as of 2026-09-06.**
Outbox + dispatcher + template registry + preferences model + Resend webhook, all built and shipped; every existing `notify*` call routes through the outbox (Section 0). Deviations from the original plan: no admin preferences UI yet (`ContactPreference` exists in the schema and is written to by suppression/bounce handling, but there's no page for a human to browse/edit it); no rules-runner generalization of the deadline cron (`deadline-reminders.yml` still runs as its own dedicated cron job, separate from the new `dispatch-messages.yml` sweep — the two were kept independent rather than merged, since the deadline logic's own dedupe columns on `Requirement` still work fine and merging added risk with no clear benefit yet). Marketing subdomain (`updates.wisesoc.in`) is verified in Resend but unused — no campaign feature exists to send from it yet.

**Phase 1 — WhatsApp channel + inbound — substantially DONE, live in production as of 2026-09-06, with real gaps.**
WhatsApp adapter, webhook (statuses + inbound), `Conversation`/`InboundMessage` schema, opt-in/opt-out button handling in `inbound-triage.ts`, kill switch + staging redirects (not in the original plan, Section 2.1 §12a) all built and live. **What's genuinely missing from the original Phase 1 scope:** no admin inbox UI at all (conversations and inbound messages are captured in the DB with nobody able to see or reply to them from an interface — a real gap, not a nice-to-have deferred item); only 2 of the full catalog's events actually fire WhatsApp messages (Section 0), not "the whole catalog"; no Hindi/Marathi templates exist, English only; no formal opt-in capture step was added to registration forms (existing users were treated as pre-opted-in per Section 9.6, and no new UI checkbox was built for new registrants either). The **two-WABA architecture (Section 3.2) and the one-webhook-per-app tradeoff (Section 3.3) were not anticipated at all** in the original plan and materially changed how this phase was actually executed.

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

### Lessons from actually building and shipping this (added 2026-09-06, not decisions — things that went wrong or nearly did)

10. **Dev and production databases got mixed up early on, and it was dangerous.** At one point local development was pointed at what turned out to be a database also reachable from a deployed environment, rather than a genuinely isolated dev copy. Resolved by explicitly separating them: local `.env` / staging use one Neon project (`ep-lucky-wildflower`), production uses a completely separate one (`ep-dark-mouse`). Lesson for any future environment work: **never assume a `DATABASE_URL` is isolated — check the Neon project id, not just that a connection string exists and works.**
11. **Vercel does not run `prisma migrate deploy` automatically on deploy, ever.** This was discovered — proactively, before it caused an incident, but only barely — while merging Phase 1 to `main`: production's database was still missing 3 migrations that had been sitting in the repo, which would have broken nearly every notification code path the moment the merged code started running against it (new columns/tables referenced by code that didn't exist in the real DB yet). Fixed by running `prisma migrate deploy` directly against production's direct (non-pooled) connection string as a manual step during the merge. **Lesson: migrations need an explicit deploy step (a build-command hook, a CI step, or a disciplined manual run) — pushing to `main` is not sufficient on its own**, and this isn't specific to messaging; it applies to every future schema change in this project.
12. **A GitHub Actions cron job failing isn't always a code bug — check secret synchronization first.** The "Deadline reminders cron" workflow failed with exit code 22 (curl's "HTTP error" code) after the merge to `main`; diagnosed via a direct `curl` reproduction as a mismatch between the `CRON_SECRET` stored in GitHub Actions secrets and the value actually set on Vercel's Production environment — the two had drifted apart at some point (likely a production env var rotation that wasn't mirrored to GitHub). Not something fixable from inside the codebase; the two secret stores need to be kept in sync by whoever manages them. The same applies to `dispatch-messages.yml`'s `CRON_SECRET`, sharing the same value.
13. **Staging's WhatsApp webhook debugging session required temporarily removing Vercel Deployment Protection from staging, and it was never turned back on.** Documented in Section 3.3 — as of 2026-09-06, `staging.wisesoc.in` is publicly reachable by anyone with the URL. This is a real, currently-open loose end, not a resolved decision — worth a deliberate call on whether to re-enable protection (and accept losing staging's webhook coverage again) or accept the current exposure with `robots.txt`'s crawler-discouragement as the only mitigation.
14. **Meta's own anti-abuse throttle (error 131049) is a real, currently-unmanaged constraint on Marketing sends, separate from whatever cap we build ourselves.** See Section 3.4 for the full incident. Because both live WhatsApp events (Section 0) ended up Marketing-classified, this throttle — which fails silently, returning `"accepted"` at send time and only revealing `failed` via the webhook later — is already the real ceiling on how often the same recipient can be messaged today, ahead of and separate from the ≤4/week cap in decision 8 above, which still isn't enforced in code. Building that cap won't make this throttle go away; it will just make our own limit tighter than Meta's, which is probably the right target to aim for once it's built.
