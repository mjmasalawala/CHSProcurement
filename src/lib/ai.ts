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
