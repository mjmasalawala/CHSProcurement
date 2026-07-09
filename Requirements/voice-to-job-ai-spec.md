# Voice-to-Job AI — Feature Spec (v1 / MVP)
**Product:** Bluejay R&M Vendor Marketplace
**Status:** Draft for development kickoff — **contains one open question, see Section 1**

---

## 1. Scope assumption (please confirm)

**Language:** this spec assumes **English-only** for v1 speech-to-text and AI extraction. Given the Indian housing-society context, Hindi and regional-language support is a very plausible near-term need — confirming now because it affects which speech-to-text provider/model to choose from day one (some handle code-switched Hindi-English far better than others), so it's cheaper to decide before building than to bolt on after.

---

## 2. Purpose

Let a Manager describe a maintenance/CapEx need **by voice** instead of typing, during Requirement creation. The system transcribes the audio, uses AI to extract a structured summary and suggest the relevant service categor(ies), and pre-fills the Requirement wizard for the Manager to review and confirm — never auto-submits.

---

## 3. Where this fits (Requirement Creation wizard)

See `theme-and-design-system.md` Section 4 and `society-portal-spec.md` Section 5 for the base wizard. This feature modifies **Step 1** ("What needs to be done"):

- Manager is offered a choice: **type a description** (existing flow) or **record/upload a voice note** (this feature).
- If voice is chosen: record in-browser (with a sensible max duration, e.g., 2-3 minutes) or upload an audio file.
- On submission of the audio, the system processes it (Section 4) and returns pre-filled values into the same wizard fields a typed description would populate — **category** and **description** — which the Manager then sees, edits if needed, and confirms before proceeding to Step 2.

**Human-in-the-loop is mandatory:** the AI never finalizes a category or description on its own. The Manager always sees and can edit the suggestion before it's submitted as part of the actual Requirement.

---

## 4. Processing pipeline

1. **Audio upload** → stored (transient or short-retention, see Section 6).
2. **Speech-to-text transcription** → produces a text transcript.
3. **AI extraction** (LLM call) on the transcript, constrained to:
   - Produce a clean, structured **description** (a concise summary, not a raw transcript dump).
   - Suggest **one or more categories**, chosen **only from the existing fixed taxonomy** (shared category list — see `unified-platform-architecture.md` Section 6). The model must not invent categories.
   - If nothing in the taxonomy fits well, return a **"no confident match"** result rather than forcing a guess.
   - Optionally flag suggested **urgency** (Routine/Urgent) if the transcript implies it (e.g., "water is leaking right now" vs. "sometime next month we should repaint").
4. **Return structured result** to the wizard: `{ description, suggested_categories[], confidence, urgency_suggestion }`.
5. Manager reviews the pre-filled Step 1 fields, edits freely, and proceeds.

**No-confident-match handling:** if the AI can't map to an existing category, fall back to the same **"Request a new category"** path vendors already use during registration (see vendor spec Section 5) — reuse that queue rather than building a separate one.

---

## 5. Data model additions (Requirement entity)

| Field | Type | Notes |
|---|---|---|
| `voice_note_url` | File reference | Original audio, if used |
| `transcript_text` | Text | Raw transcript |
| `ai_suggested_categories` | Array | Categories the model suggested |
| `ai_confidence_score` | Number | Model's confidence, for later tuning/monitoring |
| `manager_edited_ai_suggestion` | Boolean | Whether the Manager changed the AI's suggested category/description before submitting — useful signal for improving prompts over time |

---

## 6. Retention & privacy

- Store the transcript as part of the Requirement record (useful context in the archive — see society spec Section 8).
- Audio file retention: keep for a reasonable period for QA/dispute purposes (exact policy TBD — not a blocking decision for MVP build, but flag before launch).
- No special PII expected in these recordings beyond what's already visible in the description (e.g., unit number, nature of the issue) — standard data handling applies, nothing beyond the norm for the rest of the platform.

---

## 7. Explicitly out of scope for v1

- Multi-language transcription (English-only assumption, see Section 1)
- Real-time/streaming transcription (batch: record → submit → process → return is sufficient)
- Voice input anywhere other than Requirement creation Step 1 (e.g., not for bid submission, not for office bearer approvals)
- Automatic Requirement submission without Manager review (never bypass human confirmation)
