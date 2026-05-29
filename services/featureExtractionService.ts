import type {
  ContextType,
  FeatureReport,
  PausePoint,
  PostSpeechSelfCheckInput,
  RepeatedExpression,
  SpeechReport
} from "@/types/speech";

const fillerWords = ["음", "어", "그니까", "그러니까", "약간", "뭔가", "이제", "사실", "막"];
const vagueWords = ["좋다", "좋은", "많다", "많은", "느낌", "약간", "뭔가", "사실", "이제", "되게", "정말", "그런", "어떤"];
const hesitationPatterns = [/음+/g, /어+/g, /\.\.\./g, /잠깐/g, /뭐라고 해야/g];

export type ExtractSpeechFeaturesInput = {
  transcript: string;
  durationSeconds: number;
  contextType: ContextType;
  postSpeechSelfCheck?: PostSpeechSelfCheckInput;
  onboardingSelfCheck?: Record<string, string | number | boolean>;
  segmentRates?: number[];
  priorReports?: SpeechReport[];
};

export type ExtractedSpeechFeatures = {
  sentences: string[];
  tokens: string[];
  fillerCounts: Record<string, number>;
  fillerTotal: number;
  pauseData: SpeechReport["pauseData"];
  repeatedExpressions: RepeatedExpression[];
  averageSentenceLength: number;
  longSentences: SpeechReport["longSentences"];
  selfCorrections: string[];
  wpm: number;
  prepShapeCount: number;
  prepScore: number;
  keyMessageRatio: number;
  keyMessagePositionLabel: SpeechReport["structure"]["keyMessagePosition"];
  clarityScore: number;
  structureScore: number;
  deliveryScore: number;
  featureReport: FeatureReport;
};

export function extractSpeechFeatures(input: ExtractSpeechFeaturesInput): ExtractedSpeechFeatures {
  const sentences = splitSentences(input.transcript);
  const tokens = tokenize(input.transcript);
  const durationMinutes = Math.max(input.durationSeconds / 60, 0.25);
  const fillerCounts = Object.fromEntries(fillerWords.map((word) => [word, countOccurrences(input.transcript, word)]));
  const fillerTotal = Object.values(fillerCounts).reduce((sum, count) => sum + count, 0);
  const totalEojeolCount = Math.max(tokens.length, 1);
  const pauseData = buildPauseData(input.transcript, input.durationSeconds);
  const selfCorrections = extractSelfCorrections(input.transcript);
  const repeatedExpressions = extractRepeatedExpressions(tokens);
  const averageSentenceLength = Math.round(tokens.length / Math.max(sentences.length, 1));
  const longSentences = sentences
    .filter((sentence) => tokenize(sentence).length >= 18 || sentence.length >= 52)
    .map((sentence) => ({ sentence, length: tokenize(sentence).length }));
  const wpm = Math.round(totalEojeolCount / durationMinutes);
  const prepShapeCount = hasPrepShape(input.transcript);
  const prepScore = clamp01(prepShapeCount / 4);
  const { ratio: keyMessageRatio, label: keyMessagePositionLabel } = getKeyMessagePosition(input.transcript, sentences);
  const repeatedExpressionCount = repeatedExpressions.reduce((sum, item) => sum + Math.max(0, item.count - 1), 0);
  const repeatedExpressionCountPer100 = (repeatedExpressionCount / totalEojeolCount) * 100;
  const fillerRatio = fillerTotal / totalEojeolCount;
  const earlyFillerRatio = getEarlyFillerRatio(input.transcript, fillerCounts, fillerTotal);
  const pausePerMin = pauseData.count / durationMinutes;
  const actualPausePerMin = pausePerMin;
  const selfRepairPer100 = (selfCorrections.length / totalEojeolCount) * 100;
  const speechRate = totalEojeolCount / durationMinutes;
  const segmentRates = input.segmentRates?.length ? input.segmentRates : buildSegmentRates(tokens, durationMinutes);
  const wpmCv = coefficientOfVariation(segmentRates);
  const vagueCount = vagueWords.reduce((sum, word) => sum + countOccurrences(input.transcript, word), 0);
  const vagueRatio = vagueCount / totalEojeolCount;
  const ttr = new Set(tokens).size / totalEojeolCount;
  const simplifiedMtld = calculateSimplifiedMtld(tokens);
  const topicDriftScore = calculateTopicDrift(sentences);
  const discourseCoherenceScore = clamp01(1 - topicDriftScore);
  const structureProblemScore = clamp01((1 - prepScore) * 0.45 + keyMessageDelay(keyMessageRatio) * 0.35 + topicDriftScore * 0.2);
  const clarityScore = Math.max(
    35,
    Math.min(98, Math.round(94 - fillerTotal * 2.5 - longSentences.length * 4 - selfCorrections.length * 5 - repeatedExpressions.length * 1.5 - vagueCount * 1.2))
  );
  const structureScore = Math.max(35, Math.min(98, Math.round(92 - structureProblemScore * 42 - longSentences.length * 3)));
  const tooFastScore = clamp01((speechRate - 180) / 60);
  const tooSlowScore = clamp01((90 - speechRate) / 40);
  const deliverySpeedScore = Math.max(tooFastScore, tooSlowScore);
  const pauseLackScore = clamp01((4 - actualPausePerMin) / 4);
  const deliveryScore = Math.max(35, Math.min(98, Math.round(94 - deliverySpeedScore * 28 - pauseLackScore * 14 - wpmCv * 18)));
  const lexicalDiversityScore = Math.round(clamp01(ttr * 0.55 + clamp01(simplifiedMtld / 70) * 0.45) * 100);
  const nervousnessScore = ((input.postSpeechSelfCheck?.nervousnessScore ?? 3) - 1) / 4;
  const repeatedSpecificFillerScore = clamp01(Math.max(...Object.values(fillerCounts), 0) / Math.max(fillerTotal, 1));
  const fillerScore = clamp01(fillerRatio / 0.08);
  const sessionConsistencyScore = calculateSessionConsistency(input.priorReports, fillerCounts, repeatedExpressions);
  const normalizedFeatures = {
    filler_score: fillerScore,
    early_filler_score: clamp01((earlyFillerRatio - 0.2) / 0.3),
    pause_score: clamp01(pausePerMin / 8),
    pause_lack_score: pauseLackScore,
    self_repair_score: clamp01(selfRepairPer100 / 3),
    hesitation_score: clamp01(countHesitations(input.transcript) / Math.max(totalEojeolCount / 100, 1) / 5),
    delivery_speed_score: deliverySpeedScore,
    wpm_variability_score: clamp01(wpmCv / 0.35),
    sentence_length_score: clamp01((averageSentenceLength - 18) / 20),
    clarity_problem_score: 1 - clarityScore / 100,
    prep_failure_score: 1 - prepScore,
    key_message_delay_score: keyMessageDelay(keyMessageRatio),
    topic_drift_score: topicDriftScore,
    structure_problem_score: structureProblemScore,
    discourse_coherence_problem_score: 1 - discourseCoherenceScore,
    lexical_diversity_problem_score: 1 - lexicalDiversityScore / 100,
    vague_expression_score: clamp01(vagueRatio / 0.08),
    repetition_score: clamp01(repeatedExpressionCountPer100 / 5),
    repeated_specific_filler_score: repeatedSpecificFillerScore,
    low_anxiety_filler_score: fillerScore * (1 - nervousnessScore),
    session_consistency_score: sessionConsistencyScore,
    // TODO: add pitch/intensity based emphasis analysis when audio prosody extraction is available.
    emphasis_problem_score: 0,
    presentation_context_score: presentationContextScore(input.contextType),
    nervousness_score: nervousnessScore
  };

  return {
    sentences,
    tokens,
    fillerCounts,
    fillerTotal,
    pauseData,
    repeatedExpressions,
    averageSentenceLength,
    longSentences,
    selfCorrections,
    wpm,
    prepShapeCount,
    prepScore,
    keyMessageRatio,
    keyMessagePositionLabel,
    clarityScore,
    structureScore,
    deliveryScore,
    featureReport: {
      fluencyFeatures: {
        fillerRatio,
        fillerScore,
        pauseScore: normalizedFeatures.pause_score,
        selfRepairScore: normalizedFeatures.self_repair_score,
        hesitationScore: normalizedFeatures.hesitation_score,
        earlyFillerScore: normalizedFeatures.early_filler_score,
        fillerCount: fillerTotal,
        totalEojeolCount
      },
      deliveryFeatures: {
        speechRate,
        eojeolPerMinute: speechRate,
        deliverySpeedScore,
        wpmVariabilityScore: normalizedFeatures.wpm_variability_score,
        sentenceLengthScore: normalizedFeatures.sentence_length_score,
        clarityScore,
        clarityProblemScore: normalizedFeatures.clarity_problem_score,
        pauseLackScore
      },
      structureFeatures: {
        prepScore,
        prepFailureScore: normalizedFeatures.prep_failure_score,
        keyMessagePosition: keyMessageRatio,
        keyMessageDelayScore: normalizedFeatures.key_message_delay_score,
        topicDriftScore,
        structureProblemScore,
        discourseCoherenceScore
      },
      lexicalFeatures: {
        ttr,
        simplifiedMtld,
        lexicalDiversityScore,
        vagueExpressionScore: normalizedFeatures.vague_expression_score,
        repetitionScore: normalizedFeatures.repetition_score,
        repeatedExpressionCount,
        expressionPrecisionScore: clamp01(1 - normalizedFeatures.vague_expression_score)
      },
      contextFeatures: {
        contextType: input.contextType,
        presentationContextScore: normalizedFeatures.presentation_context_score,
        nervousnessScore,
        postSpeechSelfCheck: input.postSpeechSelfCheck,
        onboardingSelfCheck: input.onboardingSelfCheck
      },
      normalizedFeatures
    }
  };
}

function splitSentences(transcript: string) {
  return transcript.split(/[.!?。？！\n]+/).map((sentence) => sentence.trim()).filter(Boolean);
}

function tokenize(transcript: string) {
  return transcript.replace(/[.,!?。？！]/g, " ").split(/\s+/).map((token) => token.trim()).filter(Boolean);
}

function countOccurrences(text: string, needle: string) {
  return text.match(new RegExp(escapeRegExp(needle), "g"))?.length ?? 0;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSelfCorrections(transcript: string) {
  return transcript.match(/[^.?!。？！]{0,18}((^|[\s,])아니([\s,])|다시 말하면|정정하면|그러니까 다시)[^.?!。？！]{0,28}/g) ?? [];
}

function extractRepeatedExpressions(tokens: string[]) {
  const counts = tokens.filter((token) => token.length >= 2).reduce<Record<string, number>>((acc, token) => {
    acc[token] = (acc[token] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([expression, count]) => ({ expression, count }));
}

function buildPauseData(transcript: string, durationSeconds: number): SpeechReport["pauseData"] {
  const explicitPauses = transcript.match(/\.\.\.|…/g)?.length ?? 0;
  const estimatedLongPauses = Math.max(0, Math.round(durationSeconds / 45) - 1);
  const count = explicitPauses + estimatedLongPauses;
  const points: PausePoint[] = Array.from({ length: count }, (_, index) => ({
    position: Math.min(Math.max(transcript.length - 1, 0), 48 + index * 72),
    durationSeconds: index % 2 === 0 ? 1.1 : 1.7,
    label: index % 2 === 0 ? "medium" : "long"
  }));
  return { count, averageLengthSeconds: count > 0 ? 1.35 : 0, points };
}

function hasPrepShape(transcript: string) {
  const hasPoint = /제 생각|저는|핵심|결론|주장/.test(transcript);
  const hasReason = /왜냐하면|이유|때문/.test(transcript);
  const hasExample = /예를 들면|예시|사례/.test(transcript);
  const hasReturn = /따라서|그래서|결론적으로|다시 말해/.test(transcript);
  return [hasPoint, hasReason, hasExample, hasReturn].filter(Boolean).length;
}

function getKeyMessagePosition(transcript: string, sentences: string[]) {
  const markers = ["핵심", "결론", "제가 말하고 싶은", "중요한 점", "따라서", "그래서"];
  const markerIndex = markers.map((marker) => transcript.indexOf(marker)).filter((index) => index >= 0).sort((a, b) => a - b)[0];
  if (markerIndex === undefined) return { ratio: 1, label: "unclear" as const };
  const ratio = markerIndex / Math.max(transcript.length, 1);
  if (ratio < 0.33 || sentences[0]?.includes("결론")) return { ratio, label: "early" as const };
  if (ratio < 0.67) return { ratio, label: "middle" as const };
  return { ratio, label: "late" as const };
}

function getEarlyFillerRatio(transcript: string, fillerCounts: Record<string, number>, fillerTotal: number) {
  if (fillerTotal === 0) return 0;
  const earlyText = transcript.slice(0, Math.ceil(transcript.length * 0.2));
  const earlyCount = Object.keys(fillerCounts).reduce((sum, word) => sum + countOccurrences(earlyText, word), 0);
  return earlyCount / fillerTotal;
}

function buildSegmentRates(tokens: string[], durationMinutes: number) {
  const segmentCount = Math.max(2, Math.min(5, Math.ceil(durationMinutes * 2)));
  const perSegment = Math.max(1, Math.ceil(tokens.length / segmentCount));
  return Array.from({ length: segmentCount }, (_, index) => {
    const count = tokens.slice(index * perSegment, (index + 1) * perSegment).length;
    return count / Math.max(durationMinutes / segmentCount, 0.1);
  }).filter((rate) => rate > 0);
}

function coefficientOfVariation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (!mean) return 0;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function calculateSimplifiedMtld(tokens: string[]) {
  if (tokens.length === 0) return 0;
  const unique = new Set<string>();
  let factors = 0;
  let tokenCount = 0;
  tokens.forEach((token) => {
    unique.add(token);
    tokenCount += 1;
    if (unique.size / tokenCount <= 0.72) {
      factors += 1;
      unique.clear();
      tokenCount = 0;
    }
  });
  const partial = tokenCount > 0 ? 1 - (unique.size / Math.max(tokenCount, 1) - 0.72) / 0.28 : 0;
  return tokens.length / Math.max(factors + partial, 1);
}

function calculateTopicDrift(sentences: string[]) {
  if (sentences.length < 3) return 0;
  const firstTokens = new Set(tokenize(sentences[0]).filter((token) => token.length >= 2));
  const laterTokens = tokenize(sentences.slice(1).join(" ")).filter((token) => token.length >= 2);
  const overlap = laterTokens.filter((token) => firstTokens.has(token)).length / Math.max(laterTokens.length, 1);
  return clamp01(0.42 - overlap);
}

function keyMessageDelay(keyMessagePosition: number) {
  return clamp01((keyMessagePosition - 0.3) / 0.5);
}

function countHesitations(transcript: string) {
  return hesitationPatterns.reduce((sum, pattern) => sum + (transcript.match(pattern)?.length ?? 0), 0);
}

function presentationContextScore(contextType: ContextType) {
  if (["presentation", "interview", "class"].includes(contextType)) return 1;
  if (contextType === "meeting") return 0.5;
  return 0;
}

function calculateSessionConsistency(priorReports: SpeechReport[] | undefined, fillerCounts: Record<string, number>, repeatedExpressions: RepeatedExpression[]) {
  if (!priorReports?.length) return 0;
  const topCurrent = new Set([
    ...Object.entries(fillerCounts).filter(([, count]) => count > 0).map(([word]) => word),
    ...repeatedExpressions.slice(0, 3).map((item) => item.expression)
  ]);
  if (topCurrent.size === 0) return 0;
  const overlapSessions = priorReports.filter((report) => {
    const prior = new Set([
      ...Object.entries(report.fillerCounts).filter(([, count]) => count > 0).map(([word]) => word),
      ...report.repeatedExpressions.slice(0, 3).map((item) => item.expression)
    ]);
    return Array.from(topCurrent).some((item) => prior.has(item));
  }).length;
  return clamp01(overlapSessions / Math.min(priorReports.length, 5));
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
