import type {
  SpeechAnalysisInput,
  SpeechAnalysisProvider,
  SpeechAnalysisResult,
  SpeechIssue,
  SpeechMetric,
  SpeechMetricId,
  SpeechTranscript
} from "@/types/speechCoaching";
import { createMockTranscript } from "@/services/sttService";

const FILLER_WORDS = [
  "um",
  "uh",
  "like",
  "actually",
  "basically",
  "you know",
  "음",
  "어",
  "저",
  "그",
  "그러니까",
  "약간",
  "뭐랄까"
];

export const deterministicSpeechAnalysisProvider: SpeechAnalysisProvider = {
  async analyze(input) {
    return analyzeSpeech(input);
  }
};

export async function analyzeSpeechWithProvider(
  input: SpeechAnalysisInput,
  provider: SpeechAnalysisProvider = deterministicSpeechAnalysisProvider
): Promise<SpeechAnalysisResult> {
  return provider.analyze(input);
}

export function analyzeSpeech(input: SpeechAnalysisInput): SpeechAnalysisResult {
  const transcript = normalizeAnalysisInput(input);
  const tokens = tokenize(transcript.text);
  const wordCount = tokens.length;
  const minutes = Math.max(transcript.durationMs / 60_000, 0.05);
  const wordsPerMinute = round(wordCount / minutes, 1);
  const fillerWordCount = countFillers(transcript.text);
  const fillerWordsPerMinute = round(fillerWordCount / minutes, 1);
  const longPauseCount = countLongPauses(transcript);
  const repeatedPhraseCount = countRepeatedPhrases(tokens);

  const metrics = buildMetrics({
    wordsPerMinute,
    fillerWordsPerMinute,
    confidence: transcript.confidence,
    longPauseCount,
    repeatedPhraseCount,
    text: transcript.text
  });
  const issues = buildIssues(metrics, transcript, fillerWordCount, longPauseCount, repeatedPhraseCount);
  const overallScore = round(
    metrics.reduce((sum, metric) => sum + metric.score, 0) / Math.max(metrics.length, 1),
    0
  );

  return {
    id: `analysis-${stableHash(`${transcript.id}:${overallScore}`)}`,
    transcript,
    wordCount,
    wordsPerMinute,
    fillerWordCount,
    fillerWordsPerMinute,
    longPauseCount,
    repeatedPhraseCount,
    overallScore,
    metrics,
    issues
  };
}

function normalizeAnalysisInput(input: SpeechAnalysisInput): SpeechTranscript {
  if (input.type === "transcript") return input.transcript;
  return createMockTranscript({
    type: "text",
    text: input.text,
    durationMs: input.durationMs,
    language: input.language
  });
}

function buildMetrics(params: {
  wordsPerMinute: number;
  fillerWordsPerMinute: number;
  confidence: number;
  longPauseCount: number;
  repeatedPhraseCount: number;
  text: string;
}): SpeechMetric[] {
  const paceScore = scoreByTargetRange(params.wordsPerMinute, 105, 150, 50, 210);
  const fillerScore = clamp(100 - params.fillerWordsPerMinute * 18, 0, 100);
  const clarityScore = clamp(params.confidence * 100 - params.longPauseCount * 4, 0, 100);
  const structureScore = scoreStructure(params.text);
  const confidenceScore = clamp((paceScore + clarityScore) / 2 - params.fillerWordsPerMinute * 6, 0, 100);
  const repetitionScore = clamp(100 - params.repeatedPhraseCount * 15, 0, 100);

  return [
    createMetric("pace", "Pace", paceScore, params.wordsPerMinute, "wpm", describePace(params.wordsPerMinute)),
    createMetric(
      "filler_words",
      "Filler words",
      fillerScore,
      params.fillerWordsPerMinute,
      "per min",
      describeFillers(params.fillerWordsPerMinute)
    ),
    createMetric("clarity", "Clarity", clarityScore, params.confidence, "confidence", describeClarity(clarityScore)),
    createMetric("structure", "Structure", structureScore, structureScore, "score", describeStructure(structureScore)),
    createMetric("confidence", "Confidence", confidenceScore, confidenceScore, "score", describeConfidence(confidenceScore)),
    createMetric("repetition", "Repetition", repetitionScore, params.repeatedPhraseCount, "phrases", describeRepetition(params.repeatedPhraseCount))
  ];
}

function createMetric(
  id: SpeechMetricId,
  label: string,
  score: number,
  value: number,
  unit: string,
  summary: string
): SpeechMetric {
  return {
    id,
    label,
    score: round(score, 0),
    value: round(value, 1),
    unit,
    summary
  };
}

function buildIssues(
  metrics: SpeechMetric[],
  transcript: SpeechTranscript,
  fillerWordCount: number,
  longPauseCount: number,
  repeatedPhraseCount: number
): SpeechIssue[] {
  const issues: SpeechIssue[] = [];

  for (const metric of metrics) {
    if (metric.score >= 72) continue;

    issues.push({
      id: `issue-${metric.id}`,
      metricId: metric.id,
      severity: metric.score < 45 ? "critical" : "warning",
      title: issueTitle(metric.id),
      detail: metric.summary,
      evidence: collectEvidence(metric.id, transcript, fillerWordCount, longPauseCount, repeatedPhraseCount)
    });
  }

  return issues;
}

function collectEvidence(
  metricId: SpeechMetricId,
  transcript: SpeechTranscript,
  fillerWordCount: number,
  longPauseCount: number,
  repeatedPhraseCount: number
): string[] {
  if (metricId === "filler_words") return [`Filler words detected: ${fillerWordCount}`];
  if (metricId === "clarity") return [`Long pauses detected: ${longPauseCount}`, `STT confidence: ${transcript.confidence}`];
  if (metricId === "repetition") return [`Repeated phrases detected: ${repeatedPhraseCount}`];
  if (metricId === "pace") return [`Duration: ${Math.round(transcript.durationMs / 1000)}s`];
  return [transcript.text.slice(0, 120)];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function countFillers(text: string): number {
  const normalized = ` ${text.toLowerCase().replace(/[.,!?]/g, " ")} `;
  return FILLER_WORDS.reduce((count, filler) => {
    const pattern = new RegExp(`\\s${escapeRegExp(filler)}\\s`, "g");
    return count + (normalized.match(pattern)?.length ?? 0);
  }, 0);
}

function countLongPauses(transcript: SpeechTranscript): number {
  const segmentPauses = transcript.segments.reduce((count, segment, index, segments) => {
    if (index === 0) return count;
    return segment.startMs - segments[index - 1].endMs >= 900 ? count + 1 : count;
  }, 0);
  const textPauses = transcript.text.match(/\.{3,}|…/g)?.length ?? 0;
  return segmentPauses + textPauses;
}

function countRepeatedPhrases(tokens: string[]): number {
  const seen = new Set<string>();
  const repeated = new Set<string>();

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const phrase = `${tokens[index]} ${tokens[index + 1]}`;
    if (seen.has(phrase)) repeated.add(phrase);
    seen.add(phrase);
  }

  return repeated.size;
}

function scoreStructure(text: string): number {
  const normalized = text.toLowerCase();
  const markers = ["first", "second", "finally", "therefore", "next", "문제", "해결", "다음", "첫째", "둘째", "마지막"];
  const markerCount = markers.filter((marker) => normalized.includes(marker)).length;
  const sentenceCount = Math.max(text.split(/[.!?。！？]/).filter((sentence) => sentence.trim()).length, 1);
  return clamp(58 + markerCount * 9 + Math.min(sentenceCount, 6) * 3, 0, 100);
}

function scoreByTargetRange(value: number, minTarget: number, maxTarget: number, minAllowed: number, maxAllowed: number): number {
  if (value >= minTarget && value <= maxTarget) return 100;
  if (value < minTarget) return clamp(((value - minAllowed) / (minTarget - minAllowed)) * 100, 0, 100);
  return clamp(((maxAllowed - value) / (maxAllowed - maxTarget)) * 100, 0, 100);
}

function describePace(wordsPerMinute: number): string {
  if (wordsPerMinute < 105) return "Pace is slower than a typical presentation range.";
  if (wordsPerMinute > 150) return "Pace is faster than a typical presentation range.";
  return "Pace is within a clear presentation range.";
}

function describeFillers(fillersPerMinute: number): string {
  if (fillersPerMinute >= 3) return "Filler words are frequent enough to distract listeners.";
  if (fillersPerMinute > 1) return "Some filler words are present.";
  return "Filler words are controlled.";
}

function describeClarity(score: number): string {
  return score >= 72 ? "Speech is likely easy to transcribe." : "Clarity may be reduced by pauses or low confidence.";
}

function describeStructure(score: number): string {
  return score >= 72 ? "The talk includes recognizable structure markers." : "The talk needs clearer signposting.";
}

function describeConfidence(score: number): string {
  return score >= 72 ? "Delivery signals steady confidence." : "Delivery would benefit from steadier pace and cleaner phrasing.";
}

function describeRepetition(repeatedPhraseCount: number): string {
  return repeatedPhraseCount === 0 ? "Repeated phrases are not prominent." : "Repeated phrases may make the message feel less concise.";
}

function issueTitle(metricId: SpeechMetricId): string {
  const titles: Record<SpeechMetricId, string> = {
    pace: "Adjust pacing",
    filler_words: "Reduce filler words",
    clarity: "Improve clarity",
    structure: "Strengthen structure",
    confidence: "Build confident delivery",
    repetition: "Trim repetition"
  };
  return titles[metricId];
}

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, digits: number): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}
