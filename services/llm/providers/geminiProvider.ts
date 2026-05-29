import {
  buildExpressionRewritePrompt,
  normalizeSuggestions,
  type ExpressionProviderInput,
  type ExpressionProviderResult
} from "@/services/llm/providers/expressionProviderTypes";
import type { SentenceFeedback } from "@/types/speech";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function generateWithGemini(input: ExpressionProviderInput): Promise<ExpressionProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildExpressionRewritePrompt(input) }]
        }
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 1000,
        responseMimeType: "application/json"
      }
    })
  });

  const payload = (await response.json()) as GeminiResponse;
  if (!response.ok) throw new Error(payload.error?.message ?? "Gemini expression suggestion request failed.");

  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  const parsed = JSON.parse(stripJsonFence(text)) as { suggestions?: SentenceFeedback[] };
  const suggestions = normalizeSuggestions(parsed.suggestions ?? [], "gemini", input);
  if (!suggestions.length) throw new Error("Gemini returned no expression suggestions.");

  return { provider: "gemini", suggestions };
}

function stripJsonFence(value: string) {
  return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}
