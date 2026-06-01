import type { ContextType, SentenceFeedback } from "@/types/speech";

export type ProblematicSentenceInput = {
  original: string;
  detected_issue: string;
};

export type ExpressionProviderInput = {
  contextType: ContextType;
  sentences: ProblematicSentenceInput[];
};

export type ExpressionProviderResult = {
  provider: "gemini" | "openai";
  suggestions: SentenceFeedback[];
};

export type ExpressionProvider = (input: ExpressionProviderInput) => Promise<ExpressionProviderResult>;

export function toneForContext(contextType: ContextType): SentenceFeedback["tone"] {
  if (contextType === "formal" || contextType === "informal" || contextType === "presentation" || contextType === "class") return "presentation";
  if (contextType === "interview") return "interview";
  if (contextType === "meeting") return "meeting";
  return "conversation";
}

export function buildExpressionRewritePrompt(input: ExpressionProviderInput) {
  return [
    "너는 COMMUDENT의 한국어 표현 개선 코치다.",
    "deterministic 분석 결과로 선별된 problematic sentence chunk만 받는다.",
    "사용자의 원래 의미를 왜곡하지 말고, 원래 말투를 완전히 제거하지 않는다.",
    "더 전달력 있는 방향으로 짧고 실전적인 개선안을 추천한다.",
    "과하게 GPT스럽거나 번역투인 문장을 피하고 자연스러운 한국어를 쓴다.",
    "정답처럼 단정하지 말고 추천/개선안 형태로 작성한다.",
    "반복 표현, vague expression, 장문 구조, filler-heavy sentence를 중심으로 개선한다.",
    "강조/억양 문제는 이 API의 대상이 아니다.",
    "",
    "출력은 JSON만 반환한다. markdown code block은 쓰지 않는다.",
    "형식:",
    '{"suggestions":[{"original":"...","detected_issue":"...","improved_version":"...","explanation":"...","tone":"presentation|interview|meeting|conversation"}]}',
    "",
    "예시:",
    "입력: 그냥 뭔가 사람들이 많이 좋아했던 것 같아요.",
    "개선: 전반적으로 긍정적인 반응이 많았습니다.",
    "설명: '뭔가', '같아요' 같은 모호 표현을 줄이고 핵심 판단을 더 명확하게 전달했습니다.",
    "",
    `context_type: ${input.contextType}`,
    `tone: ${toneForContext(input.contextType)}`,
    `sentences: ${JSON.stringify(input.sentences)}`
  ].join("\n");
}

export function normalizeSuggestions(
  suggestions: SentenceFeedback[],
  provider: "gemini" | "openai",
  input: ExpressionProviderInput
): SentenceFeedback[] {
  const fallbackTone = toneForContext(input.contextType);
  return suggestions.slice(0, input.sentences.length).map((item, index) => ({
    original: item.original || input.sentences[index]?.original || "",
    detected_issue: item.detected_issue || input.sentences[index]?.detected_issue || "",
    improved_version: item.improved_version || input.sentences[index]?.original || "",
    explanation: item.explanation || "문맥에 맞춰 더 전달력 있게 다듬은 추천 표현입니다.",
    tone: item.tone || fallbackTone,
    source: provider
  }));
}
