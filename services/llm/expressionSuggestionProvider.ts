import { generateWithGemini } from "@/services/llm/providers/geminiProvider";
import { generateWithOpenAI } from "@/services/llm/providers/openaiProvider";
import type { ExpressionProviderInput, ExpressionProviderResult } from "@/services/llm/providers/expressionProviderTypes";

type ProviderName = "gemini" | "openai";

export async function generateExpressionSuggestions(input: ExpressionProviderInput): Promise<ExpressionProviderResult> {
  const providers = providerOrder();
  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const result = provider === "gemini" ? await generateWithGemini(input) : await generateWithOpenAI(input);
      console.log(`[ExpressionSuggestion] provider=${result.provider} suggestions=${result.suggestions.length} fallback=false`);
      return result;
    } catch (error) {
      errors.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
      console.warn(`[ExpressionSuggestion] provider=${provider} failed`, error);
    }
  }

  throw new Error(`All expression providers failed. ${errors.join(" | ")}`);
}

function providerOrder(): ProviderName[] {
  const configured = (process.env.EXPRESSION_PROVIDER || "gemini").toLowerCase();
  if (configured === "openai") return ["openai", "gemini"];
  return ["gemini", "openai"];
}
