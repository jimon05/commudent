import {
  buildExpressionRewritePrompt,
  normalizeSuggestions,
  type ExpressionProviderInput,
  type ExpressionProviderResult
} from "@/services/llm/providers/expressionProviderTypes";
import type { SentenceFeedback } from "@/types/speech";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
  error?: { message?: string };
};

export async function generateWithOpenAI(input: ExpressionProviderInput): Promise<ExpressionProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EXPRESSION_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "developer",
          content: [{ type: "input_text", text: buildExpressionRewritePrompt(input) }]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "expression_suggestions",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    original: { type: "string" },
                    detected_issue: { type: "string" },
                    improved_version: { type: "string" },
                    explanation: { type: "string" },
                    tone: { type: "string", enum: ["presentation", "interview", "meeting", "conversation"] }
                  },
                  required: ["original", "detected_issue", "improved_version", "explanation", "tone"]
                }
              }
            },
            required: ["suggestions"]
          }
        }
      },
      max_output_tokens: 1000
    })
  });

  const payload = (await response.json()) as OpenAIResponse;
  if (!response.ok) throw new Error(payload.error?.message ?? "OpenAI expression suggestion request failed.");

  const text = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).map((content) => content.text).filter(Boolean).join("") ?? "";
  const parsed = JSON.parse(text) as { suggestions?: SentenceFeedback[] };
  const suggestions = normalizeSuggestions(parsed.suggestions ?? [], "openai", input);
  if (!suggestions.length) throw new Error("OpenAI returned no expression suggestions.");

  return { provider: "openai", suggestions };
}
