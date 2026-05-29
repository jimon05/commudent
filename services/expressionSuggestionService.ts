import type { ContextType, SentenceFeedback, SpeechReport } from "@/types/speech";

type ProblematicSentence = {
  original: string;
  detected_issue: string;
};

const cachePrefix = "commudent-expression-suggestions:";
const vaguePattern = /(그냥|뭔가|약간|같아요|느낌|되게|정말|많이|좋았던 것|좋은 것)/;
const fillerPattern = /(음|어|그니까|그러니까|막|이제)/;

export async function createSentenceFeedback(input: {
  sentences: string[];
  contextType: ContextType;
  longSentences: SpeechReport["longSentences"];
  repeatedExpressions: SpeechReport["repeatedExpressions"];
}): Promise<SentenceFeedback[]> {
  const problematicSentences = selectProblematicSentences(input);
  if (!problematicSentences.length) return [];

  const cacheKey = buildCacheKey(input.contextType, problematicSentences);
  const cached = readCachedSuggestions(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch("/api/expression-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context_type: input.contextType,
        sentences: problematicSentences
      })
    });
    const payload = (await response.json()) as { provider?: "gemini" | "openai" | "fallback"; suggestions?: SentenceFeedback[]; error?: string };
    if (!response.ok || !payload.suggestions?.length) throw new Error(payload.error ?? "표현 개선 API 응답이 비어 있습니다.");

    const normalized = payload.suggestions.map((item) => ({ ...item, source: payload.provider === "openai" ? "openai" as const : "gemini" as const }));
    writeCachedSuggestions(cacheKey, normalized);
    return normalized;
  } catch (error) {
    console.warn("OpenAI expression rewriting failed. Rule-based fallback was used.", error);
    const fallback = problematicSentences.map((item) => fallbackRewrite(item, input.contextType));
    writeCachedSuggestions(cacheKey, fallback);
    return fallback;
  }
}

function selectProblematicSentences(input: {
  sentences: string[];
  longSentences: SpeechReport["longSentences"];
  repeatedExpressions: SpeechReport["repeatedExpressions"];
}) {
  const longSet = new Set(input.longSentences.map((item) => item.sentence));
  const repeated = new Set(input.repeatedExpressions.filter((item) => item.count >= 2).map((item) => item.expression));
  return input.sentences
    .map((sentence) => {
      const issues: string[] = [];
      if (fillerPattern.test(sentence)) issues.push("filler/습관 표현");
      if (vaguePattern.test(sentence)) issues.push("모호 표현");
      if (longSet.has(sentence)) issues.push("장문 구조");
      if (Array.from(repeated).some((word) => sentence.includes(word))) issues.push("반복 표현");
      return { original: sentence, detected_issue: issues.join(", ") };
    })
    .filter((item) => item.detected_issue)
    .slice(0, 6);
}

function fallbackRewrite(item: ProblematicSentence, contextType: ContextType): SentenceFeedback {
  const tone = toneForContext(contextType);
  let improved = item.original
    .replace(/음|어|그니까|그러니까|막|이제/g, "")
    .replace(/그냥\s*/g, "")
    .replace(/뭔가\s*/g, "")
    .replace(/약간\s*/g, "")
    .replace(/많이 좋아했던 것 같아요/g, "긍정적인 반응이 많았습니다")
    .replace(/좋았던 것 같아요/g, "긍정적으로 볼 수 있습니다")
    .replace(/같아요/g, "것으로 보입니다")
    .trim();

  if (item.detected_issue.includes("장문 구조") && improved.length > 46) {
    improved = `${improved.slice(0, 42)}. 이 내용을 두 문장으로 나누어 전달해보는 것을 추천합니다.`;
  }
  if (!improved) improved = item.original;

  return {
    original: item.original,
    detected_issue: item.detected_issue,
    improved_version: improved,
    explanation: "OpenAI API 호출 실패로 fallback 규칙을 사용했습니다. filler와 모호 표현을 줄이고 원래 의미를 유지하는 방향의 추천입니다.",
    tone,
    source: "fallback"
  };
}

function toneForContext(contextType: ContextType): SentenceFeedback["tone"] {
  if (contextType === "presentation" || contextType === "class") return "presentation";
  if (contextType === "interview") return "interview";
  if (contextType === "meeting") return "meeting";
  return "conversation";
}

function buildCacheKey(contextType: ContextType, sentences: ProblematicSentence[]) {
  return `${cachePrefix}${contextType}:${hashText(JSON.stringify(sentences))}`;
}

function readCachedSuggestions(key: string) {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SentenceFeedback[];
  } catch {
    return null;
  }
}

function writeCachedSuggestions(key: string, suggestions: SentenceFeedback[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(suggestions));
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
