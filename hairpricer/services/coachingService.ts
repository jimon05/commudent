import type {
  CoachingOptions,
  CoachingPlan,
  CoachingProvider,
  CoachingRecommendation,
  SpeechAudioInput,
  SpeechAnalysisResult,
  SpeechCoachingPipelineOptions,
  SpeechMetricId
} from "@/types/speechCoaching";
import { analyzeSpeechWithProvider } from "@/services/speechAnalysisService";
import { transcribeSpeech } from "@/services/sttService";

export const deterministicCoachingProvider: CoachingProvider = {
  async createPlan(analysis, options) {
    return createCoachingPlan(analysis, options);
  }
};

export async function createSpeechCoachingPlan(
  input: SpeechAudioInput,
  options?: SpeechCoachingPipelineOptions
): Promise<CoachingPlan> {
  const transcript = await transcribeSpeech(input, options?.sttOptions, options?.sttProvider);
  const analysis = await analyzeSpeechWithProvider(
    { type: "transcript", transcript },
    options?.analysisProvider
  );
  return (options?.coachingProvider ?? deterministicCoachingProvider).createPlan(analysis, options);
}

export function createCoachingPlan(analysis: SpeechAnalysisResult, options?: CoachingOptions): CoachingPlan {
  const sortedMetrics = [...analysis.metrics].sort((a, b) => a.score - b.score);
  const maxRecommendations = options?.maxRecommendations ?? 3;
  const recommendations = sortedMetrics
    .filter((metric) => metric.score < 82)
    .slice(0, maxRecommendations)
    .map((metric) => recommendationFor(metric.id, analysis, options));
  const strengths = analysis.metrics
    .filter((metric) => metric.score >= 82)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((metric) => `${metric.label}: ${metric.summary}`);

  return {
    id: `coaching-${analysis.id}`,
    headline: buildHeadline(analysis.overallScore, options),
    summary: buildSummary(analysis, options),
    score: analysis.overallScore,
    strengths: strengths.length > 0 ? strengths : ["You have a usable baseline recording to improve from."],
    recommendations: recommendations.length > 0 ? recommendations : [maintenanceRecommendation()],
    nextPracticePrompt: buildPracticePrompt(analysis, options)
  };
}

function buildHeadline(score: number, options?: CoachingOptions): string {
  const goal = options?.goal ? ` for ${options.goal}` : "";
  if (score >= 85) return `Polished delivery${goal}`;
  if (score >= 70) return `Solid delivery with clear improvement targets${goal}`;
  return `Focused practice plan${goal}`;
}

function buildSummary(analysis: SpeechAnalysisResult, options?: CoachingOptions): string {
  const tonePrefix = options?.tone === "executive" ? "Priority readout" : options?.tone === "direct" ? "Direct read" : "Coaching read";
  return `${tonePrefix}: ${analysis.wordCount} words at ${analysis.wordsPerMinute} wpm, ${analysis.fillerWordCount} filler words, and an overall score of ${analysis.overallScore}.`;
}

function recommendationFor(
  metricId: SpeechMetricId,
  analysis: SpeechAnalysisResult,
  options?: CoachingOptions
): CoachingRecommendation {
  const priority = analysis.metrics.find((metric) => metric.id === metricId)?.score ?? 100;
  const recommendationPriority = priority < 55 ? "high" : priority < 72 ? "medium" : "low";
  const goalSuffix = options?.goal ? ` Keep the practice tied to ${options.goal}.` : "";

  const recommendations: Record<SpeechMetricId, Omit<CoachingRecommendation, "id" | "priority">> = {
    pace: {
      title: "Rehearse with a pacing target",
      rationale: `Current pace is ${analysis.wordsPerMinute} wpm, outside the 105-150 wpm coaching band.`,
      practice: `Record a 60-second version and aim for 115-135 wpm.${goalSuffix}`
    },
    filler_words: {
      title: "Replace fillers with silent pauses",
      rationale: `${analysis.fillerWordCount} filler words were detected in this sample.`,
      practice: `Mark three transition points and pause for one beat instead of saying a filler.${goalSuffix}`
    },
    clarity: {
      title: "Make sentence endings cleaner",
      rationale: `The transcript confidence is ${analysis.transcript.confidence}, with ${analysis.longPauseCount} long pauses detected.`,
      practice: `Repeat the opening and closing sentences until every final word lands clearly.${goalSuffix}`
    },
    structure: {
      title: "Add explicit signposts",
      rationale: "The speech needs clearer markers so listeners can track the argument.",
      practice: `Use a simple sequence: problem, evidence, recommendation, next step.${goalSuffix}`
    },
    confidence: {
      title: "Stabilize delivery",
      rationale: "Confidence is inferred from pace, clarity, and filler control.",
      practice: `Stand, breathe low for four counts, and deliver the first sentence without rushing.${goalSuffix}`
    },
    repetition: {
      title: "Tighten repeated phrasing",
      rationale: `${analysis.repeatedPhraseCount} repeated phrase patterns were detected.`,
      practice: `Rewrite repeated two-word phrases into one sharper sentence before the next recording.${goalSuffix}`
    }
  };

  return {
    id: `rec-${metricId}`,
    priority: recommendationPriority,
    ...recommendations[metricId]
  };
}

function maintenanceRecommendation(): CoachingRecommendation {
  return {
    id: "rec-maintain",
    priority: "low",
    title: "Preserve the current delivery pattern",
    rationale: "Core coaching metrics are already in a strong range.",
    practice: "Do one final rehearsal and keep the same pacing, structure, and pause pattern."
  };
}

function buildPracticePrompt(analysis: SpeechAnalysisResult, options?: CoachingOptions): string {
  const weakestMetric = [...analysis.metrics].sort((a, b) => a.score - b.score)[0];
  const goal = options?.goal ?? "the same topic";
  return `Record a new 90-second take on ${goal}, improving ${weakestMetric.label.toLowerCase()} while keeping the message concise.`;
}
