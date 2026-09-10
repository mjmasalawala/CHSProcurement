import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const UNITS = ["sqft", "sqm", "nos", "lump sum", "kg", "hour", "day", "month", "other"] as const;

// Manager-upload-a-vendor-quote feature (drag-and-drop, see
// lib/bid-documents.ts) — deliberately Haiku rather than the Sonnet calls
// above: this is a straight extraction task (read the document, fill the
// form), not open-ended reasoning, and every field the model returns is
// reviewed and editable by the Manager before a Bid is ever created, so a
// slower/pricier model isn't buying much safety margin. Revisit if real-world
// accuracy on messy vendor PDFs doesn't hold up.
const EXTRACTION_MODEL = "claude-haiku-4-5-20251001";

export interface SuggestedLineItem {
  description: string;
  quantity: string;
  unit: string;
}

const SUGGEST_LINE_ITEMS_TOOL: Anthropic.Tool = {
  name: "suggest_line_items",
  description: "Return the draft quote line items extracted from a requirement description.",
  input_schema: {
    type: "object",
    properties: {
      lineItems: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "string" },
            unit: { type: "string", enum: [...UNITS] },
          },
          required: ["description", "quantity", "unit"],
        },
      },
    },
    required: ["lineItems"],
  },
};

/**
 * Drafts starting-point quote line items from a requirement's free-text
 * description (society-portal-spec.md — vendor quote form). Never suggests
 * a unitRate: pricing is the vendor's call, not something to put words in
 * their mouth about. Vendors review/edit every suggested row before
 * submitting, same as a manually typed one.
 */
export async function suggestLineItems(requirementDescription: string, category: string): Promise<SuggestedLineItem[]> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    tools: [SUGGEST_LINE_ITEMS_TOOL],
    tool_choice: { type: "tool", name: "suggest_line_items" },
    messages: [
      {
        role: "user",
        content: `A housing society posted this work requirement with the """"${category}"""" service category. 
                  Break it down into a draft list of work order quotation line items a vendor would submit 
                  a price against — one line item per distinct scope of work or material. 
                  Include labour and transport expenses as line items where appropriate
                  Keep descriptions short (under 100 chars) and concrete. 
                  Estimate a reasonable quantity only when the text implies one (e.g. "3 bathrooms" or "2000 sqft"); 
                  otherwise use "1". Pick the closest unit from the allowed list.

                  Requirement description:
                  """
                  ${requirementDescription}
                  """`,
      },
    ],
  });

  const toolUse = message.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
  if (!toolUse) return [];

  const result = toolUse.input as { lineItems?: SuggestedLineItem[] };
  return result.lineItems ?? [];
}

const FLAG_MISSING_DETAILS_TOOL: Anthropic.Tool = {
  name: "flag_missing_details",
  description:
    "Return up to 4 short clarifying questions for details a vendor would need to quote this requirement accurately, if any are missing. Empty array if the description is already specific enough.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        maxItems: 4,
        items: { type: "string" },
      },
    },
    required: ["questions"],
  },
};

/**
 * Soft completeness check run once, when the society moves past the
 * description step (requirement-completeness brainstorm, 2026-07-21) — never
 * blocks submission, just surfaces up to a few short questions a vendor
 * would otherwise have to ask (or guess at) before quoting. Empty result
 * means the description already looks quotable; callers should treat any
 * failure the same way (fail open, skip straight through).
 */
export async function checkRequirementCompleteness(
  requirementDescription: string,
  categories: string[],
): Promise<string[]> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 512,
    tools: [FLAG_MISSING_DETAILS_TOOL],
    tool_choice: { type: "tool", name: "flag_missing_details" },
    messages: [
      {
        role: "user",
        content: `Act as a professional in the """${categories.join(", ")}""" industry.  
                  A housing society is raising a work requirement in the """${categories.join(", ")}""" service
                  category/categories. Vendors will quote a price against this description alone, with no
                  site visit guaranteed. Identify only the specific, concrete details (e.g. quantity,
                  dimensions, material/brand, fixture type, wattage, area in sqft, structure height — whatever is actually
                  relevant to this trade) that are missing and would materially change a vendor's quote.
                  Ask at most 5 short questions (under 10 words each), and only ones that matter — if the
                  description is already specific enough to quote, return an empty list. Don't ask about
                  budget, warranty, timeline, or anything already covered elsewhere in the requirement form.

                  Requirement description:
                  """
                  ${requirementDescription}
                  """`,
      },
    ],
  });

  const toolUse = message.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
  if (!toolUse) return [];

  const result = toolUse.input as { questions?: string[] };
  return result.questions ?? [];
}

export interface ExtractedBidLineItem {
  description: string;
  quantity: string;
  unit: string;
  unitRate: string;
  // "" when the document isn't GST-compliant / doesn't break out GST.
  gstRate: string;
}

export interface ExtractedBid {
  lineItems: ExtractedBidLineItem[];
  bidValidity: string | null; // ISO yyyy-mm-dd
  paymentTerms: string | null;
  warrantyPeriod: string | null;
  completionTime: string | null;
  notes: string | null;
  gstNumber: string | null;
  // The grand total as printed on the document itself, if any — compared
  // against the sum of parsed line items so a mismatch (misread rate,
  // missed row, OCR error) surfaces as a warning to the Manager instead of
  // silently going through. Never used as the Bid's actual totalAmount.
  documentStatedTotal: string | null;
}

const EXTRACT_BID_TOOL: Anthropic.Tool = {
  name: "extract_bid_from_document",
  description: "Return the structured quote (line items + terms) found in a vendor's uploaded quotation document.",
  input_schema: {
    type: "object",
    properties: {
      lineItems: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "string" },
            unit: { type: "string", enum: [...UNITS] },
            unitRate: { type: "string", description: "Numeric string, no currency symbol or thousands separators." },
            gstRate: {
              type: "string",
              description: "GST % for this line, as a plain number string. Empty string if not GST-compliant or not stated.",
            },
          },
          required: ["description", "quantity", "unit", "unitRate", "gstRate"],
        },
      },
      bidValidity: { type: ["string", "null"], description: "ISO date (yyyy-mm-dd) the quote is valid until, if stated." },
      paymentTerms: { type: ["string", "null"] },
      warrantyPeriod: { type: ["string", "null"] },
      completionTime: { type: ["string", "null"] },
      notes: { type: ["string", "null"], description: "Any other terms/conditions worth carrying over." },
      gstNumber: { type: ["string", "null"], description: "The vendor's GSTIN if printed on the document." },
      documentStatedTotal: {
        type: ["string", "null"],
        description: "The grand total exactly as printed on the document, numeric string, no currency symbol.",
      },
    },
    required: ["lineItems", "bidValidity", "paymentTerms", "warrantyPeriod", "completionTime", "notes", "gstNumber", "documentStatedTotal"],
  },
};

const EXTRACT_BID_PROMPT = `A Manager is drag-and-dropping a vendor's own quotation document into a housing-society
procurement system to save the vendor from re-typing it. Extract every quote line item (description,
quantity, unit, unit rate, and GST % if this is a GST-compliant quote) exactly as they appear —
don't invent, round, or omit any. Pick the closest unit from the allowed list; use "nos" if genuinely
ambiguous. Also pull out the quote validity date, payment terms, warranty/guarantee period, estimated
completion time, any other notes/terms, the vendor's GSTIN if printed, and the grand total exactly as
printed on the document (for a sanity cross-check — leave it null if there's no single stated total).
Numeric fields are plain number strings: no ₹, no commas, no words. If a field genuinely isn't present
in the document, return null (or "" for gstRate) rather than guessing.`;

type ExtractBidInput =
  | { kind: "text"; text: string }
  | { kind: "pdf"; base64: string }
  | { kind: "image"; base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };

/**
 * Manager-upload-a-vendor-quote feature (society-portal-spec.md — drag a
 * vendor's PDF/image/Excel quote onto an invited-vendor row). Runs on Haiku
 * (see EXTRACTION_MODEL) — a straight extraction task, always reviewed and
 * edited by the Manager before it becomes a real Bid, never auto-submitted.
 * Excel files are converted to text before reaching here (lib/spreadsheet-
 * text.ts) since Claude has no native spreadsheet input; PDF/image go in as
 * native document/image content blocks.
 */
export async function extractBidFromDocument(input: ExtractBidInput): Promise<ExtractedBid> {
  const content: Anthropic.ContentBlockParam[] =
    input.kind === "text"
      ? [{ type: "text", text: `${EXTRACT_BID_PROMPT}\n\nDocument contents (converted from spreadsheet):\n"""\n${input.text}\n"""` }]
      : input.kind === "pdf"
        ? [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: input.base64 } },
            { type: "text", text: EXTRACT_BID_PROMPT },
          ]
        : [
            { type: "image", source: { type: "base64", media_type: input.mediaType, data: input.base64 } },
            { type: "text", text: EXTRACT_BID_PROMPT },
          ];

  const message = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 2048,
    tools: [EXTRACT_BID_TOOL],
    tool_choice: { type: "tool", name: "extract_bid_from_document" },
    messages: [{ role: "user", content }],
  });

  const toolUse = message.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
  if (!toolUse) {
    return {
      lineItems: [],
      bidValidity: null,
      paymentTerms: null,
      warrantyPeriod: null,
      completionTime: null,
      notes: null,
      gstNumber: null,
      documentStatedTotal: null,
    };
  }

  return toolUse.input as ExtractedBid;
}
