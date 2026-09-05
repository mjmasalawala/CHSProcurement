// Inbound WhatsApp triage — Requirements/messaging-and-engagement-spec.md,
// Section 2.1 §8, revised: NO AI CALL on free text at launch. A single
// stateless Claude call on one incoming message, with no real conversation
// memory or grounding, is exactly the setup most likely to hallucinate in
// front of a real customer — so free text always goes to a human, full
// stop. Only structured button/list taps are auto-handled, since those are
// a fixed, enumerable set of payloads matched below, not interpreted by a
// model.
//
// This is deliberately one function with one narrow job (classify + decide
// auto vs. human), called once per inbound message from the webhook
// handler. Swapping in a real, trained/grounded classifier later — when
// there's history to train it on — means replacing what's inside this
// function; the webhook, Conversation/InboundMessage schema, and inbox UI
// don't change. See the spec doc for the full rationale.

// Reserved button/list payload ids — used both here (matching an inbound
// tap) and by whatever eventually sends the interactive buttons offering
// these choices (not built yet — no outbound template exists with buttons).
export const OPT_OUT_BUTTON_ID = "wisesoc_stop_messages";
export const OPT_IN_BUTTON_ID = "wisesoc_accept_messages";

export type InboundIntent = "OPT_OUT" | "OPT_IN" | "UNKNOWN";

export interface TriageResult {
  intent: InboundIntent;
  // Auto-sendable because it's a fixed, pre-written confirmation — not
  // generated per-message.
  autoReplyText?: string;
}

const STOP_KEYWORDS = new Set(["stop", "unsubscribe"]);
const START_KEYWORDS = new Set(["start", "subscribe"]);

const OPT_OUT_REPLY = "You've been unsubscribed from Wisesoc WhatsApp messages. Reply START anytime to opt back in.";
const OPT_IN_REPLY = "You're opted in to Wisesoc WhatsApp messages. Reply STOP anytime to opt out.";

export function triageInbound(input: { buttonPayload?: string | null; text?: string | null }): TriageResult {
  if (input.buttonPayload === OPT_OUT_BUTTON_ID) return { intent: "OPT_OUT", autoReplyText: OPT_OUT_REPLY };
  if (input.buttonPayload === OPT_IN_BUTTON_ID) return { intent: "OPT_IN", autoReplyText: OPT_IN_REPLY };

  // Meta (and most messaging platforms) treat STOP/START as a standing
  // opt-out/in convention independent of any button — plain deterministic
  // keyword matching, not an AI call, so this doesn't conflict with the "no
  // AI on free text" rule above.
  const normalized = input.text?.trim().toLowerCase();
  if (normalized && STOP_KEYWORDS.has(normalized)) return { intent: "OPT_OUT", autoReplyText: OPT_OUT_REPLY };
  if (normalized && START_KEYWORDS.has(normalized)) return { intent: "OPT_IN", autoReplyText: OPT_IN_REPLY };

  return { intent: "UNKNOWN" };
}
