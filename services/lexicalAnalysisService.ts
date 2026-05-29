import type { FeatureReport, LexicalReport, RepeatedExpression } from "@/types/speech";

const recommendedExpressions = ["뚜렷한 개선", "높은 관심", "긍정적인 반응", "구체적인 변화", "핵심적인 차이", "검증 가능한 근거"];

export function createLexicalReport(input: {
  recordingId: string;
  transcript: string;
  featureReport: FeatureReport;
  repeatedExpressions: RepeatedExpression[];
}): LexicalReport {
  const genericWords = ["좋다", "좋은", "많다", "많은", "느낌", "약간", "뭔가", "사실", "이제", "되게", "정말"];
  const repeatedGenericWords = genericWords
    .map((word) => ({ expression: word, count: countText(input.transcript, word) }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const lexical = input.featureReport.lexicalFeatures;

  return {
    recordingId: input.recordingId,
    lexicalDiversityScore: lexical.lexicalDiversityScore,
    repeatedGenericWords,
    recommendedExpressions,
    summary:
      lexical.vagueExpressionScore >= 0.35 || repeatedGenericWords.length > 0
        ? "범용 표현과 반복 표현이 일부 관찰되었습니다. 같은 의미라도 더 구체적인 단어로 바꾸면 메시지가 선명해집니다."
        : "어휘 다양성과 표현 선명도가 비교적 안정적으로 관찰되었습니다.",
    createdAt: new Date().toISOString()
  };
}

function countText(text: string, needle: string) {
  return text.match(new RegExp(needle, "g"))?.length ?? 0;
}
