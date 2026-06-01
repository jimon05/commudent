import { inferCauseScores } from "@/services/causeInferenceService";
import { createSentenceFeedback } from "@/services/expressionSuggestionService";
import { extractSpeechFeatures } from "@/services/featureExtractionService";
import { createLexicalReport } from "@/services/lexicalAnalysisService";
import { createImprovedVersion, createReportSummary } from "@/services/reportGenerationService";
import { createTrainingRecommendations } from "@/services/trainingRecommendationService";
import type { ContextType, PreSpeechSurveyInput, PostSpeechSelfCheckInput, SpeechReport } from "@/types/speech";

export async function analyzeSpeech(input: {
  recordingId: string;
  title: string;
  contextType: ContextType;
  transcript: string;
  durationSeconds: number;
  survey: PreSpeechSurveyInput;
  postSpeechSelfCheck?: PostSpeechSelfCheckInput;
  onboardingSelfCheck?: Record<string, string | number | boolean>;
  hasUserVoiceProfile?: boolean;
  priorReports?: SpeechReport[];
}): Promise<SpeechReport> {
  const contextType = input.postSpeechSelfCheck?.contextType ?? input.contextType;
  const extracted = extractSpeechFeatures({
    transcript: input.transcript,
    durationSeconds: input.durationSeconds,
    contextType,
    postSpeechSelfCheck: input.postSpeechSelfCheck,
    onboardingSelfCheck: input.onboardingSelfCheck,
    priorReports: input.priorReports
  });
  const causeInference = inferCauseScores({
    featureReport: extracted.featureReport,
    onboardingSelfCheck: input.onboardingSelfCheck,
    hasUserVoiceProfile: Boolean(input.hasUserVoiceProfile)
  });
  const lexicalReport = createLexicalReport({
    recordingId: input.recordingId,
    transcript: input.transcript,
    featureReport: extracted.featureReport,
    repeatedExpressions: extracted.repeatedExpressions
  });
  const reportSummary = createReportSummary({
    featureReport: extracted.featureReport,
    causeCandidates: causeInference.topCauses,
    fillerTotal: extracted.fillerTotal,
    repeatedCount: extracted.repeatedExpressions.length,
    clarityScore: extracted.clarityScore,
    lexicalDiversityScore: lexicalReport.lexicalDiversityScore
  });
  const coachingPlan = createTrainingRecommendations(causeInference.topCauses);

  return {
    id: input.recordingId,
    recordingId: input.recordingId,
    title: input.title,
    contextType,
    transcript: input.transcript,
    durationSeconds: input.durationSeconds,
    createdAt: new Date().toISOString(),
    featureReport: extracted.featureReport,
    sentenceFeedback: await createSentenceFeedback({
      sentences: extracted.sentences,
      contextType,
      longSentences: extracted.longSentences,
      repeatedExpressions: extracted.repeatedExpressions
    }),
    goodPoints: reportSummary.goodPoints,
    nextGoal: reportSummary.nextGoal,
    postSpeechSelfCheck: input.postSpeechSelfCheck,
    lexicalReport,
    fillerCounts: extracted.fillerCounts,
    pauseData: extracted.pauseData,
    repeatedExpressions: extracted.repeatedExpressions,
    averageSentenceLength: extracted.averageSentenceLength,
    longSentences: extracted.longSentences,
    wpm: extracted.wpm,
    selfCorrections: extracted.selfCorrections,
    structure: {
      intro: extracted.sentences[0] ?? "도입이 명확하지 않습니다.",
      body: extracted.sentences.slice(1, -1).join(" ") || "본론 정보가 짧게 제시되었습니다.",
      conclusion: extracted.sentences.at(-1) ?? "결론이 명확하지 않습니다.",
      keyMessagePosition: extracted.keyMessagePositionLabel
    },
    clarityScore: extracted.clarityScore,
    structureScore: extracted.structureScore,
    deliveryScore: extracted.deliveryScore,
    feedbackSummary: reportSummary.summary,
    causeScores: causeInference.scores,
    causeCandidates: causeInference.topCauses,
    coachingPlan,
    improvedVersion: createImprovedVersion(input.transcript),
    weeklyTrend: {
      averageWpm: extracted.wpm,
      fillerChangePercent: 0,
      pauseChangePercent: 0,
      structureScore: extracted.structureScore,
      clarityScore: extracted.clarityScore,
      patternSummary: "장기 리포트는 발표 기록이 누적될수록 핵심 내용 전달도와 다음 발표 초점을 비교합니다."
    }
  };
}
