import { NextResponse } from "next/server";
import { generateExpressionSuggestions } from "@/services/llm/expressionSuggestionProvider";
import type { ContextType } from "@/types/speech";

export const runtime = "nodejs";

type RequestBody = {
  context_type?: ContextType;
  sentences?: Array<{ original: string; detected_issue: string }>;
};

export async function POST(request: Request) {
  const body = (await request.json()) as RequestBody;
  const contextType = body.context_type ?? "presentation";
  const sentences = (body.sentences ?? []).filter((item) => item.original && item.detected_issue).slice(0, 6);

  if (!sentences.length) return NextResponse.json({ provider: "none", suggestions: [] });

  try {
    const result = await generateExpressionSuggestions({ contextType, sentences });
    return NextResponse.json(result);
  } catch (error) {
    console.log("[ExpressionSuggestion] provider=rule-based suggestions=0 fallback=true");
    return NextResponse.json(
      {
        provider: "fallback",
        error: error instanceof Error ? error.message : "Expression suggestion providers failed."
      },
      { status: 503 }
    );
  }
}
