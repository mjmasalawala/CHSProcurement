import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const UNITS = ["sqft", "sqm", "nos", "lump sum", "kg", "hour", "day", "month", "other"] as const;

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
