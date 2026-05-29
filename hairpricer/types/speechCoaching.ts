export type SpeechLanguage = "ko" | "en" | "mixed";

export type SpeechAudioInput =
  | {
      type: "text";
      text: string;
      durationMs?: number;
      language?: SpeechLanguage;
    }
  | {
      type: "file";
      fileName: string;
      contentType: string;
      bytes: ArrayBuffer;
      durationMs?: number;
      language?: SpeechLanguage;
    }
  | {
      type: "url";
      audioUrl: string;
      durationMs?: number;
      language?: SpeechLanguage;
    };

export type TranscriptSegment = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
  speakerLabel?: string;
};

export type SpeechTranscript = {
  id: string;
  text: string;
  language: SpeechLanguage;
  durationMs: number;
  confidence: number;
  segments: TranscriptSegment[];
  sourceType: SpeechAudioInput["type"];
};

export type SttOptions = {
  language?: SpeechLanguage;
  mockTranscriptText?: string;
  durationMs?: number;
};

export type SttProvider = {
  transcribe(input: SpeechAudioInput, options?: SttOptions): Promise<SpeechTranscript>;
};

export type SpeechMetricId =
  | "pace"
  | "filler_words"
  | "clarity"
  | "structure"
  | "confidence"
  | "repetition";

export type SpeechMetric = {
  id: SpeechMetricId;
  label: string;
  score: number;
  value: number;
  unit: string;
  summary: string;
};

export type SpeechIssueSeverity = "info" | "warning" | "critical";

export type SpeechIssue = {
  id: string;
  metricId: SpeechMetricId;
  severity: SpeechIssueSeverity;
  title: string;
  detail: string;
  evidence: string[];
};

export type SpeechAnalysisInput =
  | {
      type: "transcript";
      transcript: SpeechTranscript;
    }
  | {
      type: "text";
      text: string;
      durationMs?: number;
      language?: SpeechLanguage;
    };

export type SpeechAnalysisResult = {
  id: string;
  transcript: SpeechTranscript;
  wordCount: number;
  wordsPerMinute: number;
  fillerWordCount: number;
  fillerWordsPerMinute: number;
  longPauseCount: number;
  repeatedPhraseCount: number;
  overallScore: number;
  metrics: SpeechMetric[];
  issues: SpeechIssue[];
};

export type CoachingTone = "supportive" | "direct" | "executive";

export type CoachingOptions = {
  goal?: string;
  tone?: CoachingTone;
  maxRecommendations?: number;
};

export type CoachingRecommendation = {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  rationale: string;
  practice: string;
};

export type CoachingPlan = {
  id: string;
  headline: string;
  summary: string;
  score: number;
  strengths: string[];
  recommendations: CoachingRecommendation[];
  nextPracticePrompt: string;
};

export type SpeechAnalysisProvider = {
  analyze(input: SpeechAnalysisInput): Promise<SpeechAnalysisResult>;
};

export type CoachingProvider = {
  createPlan(analysis: SpeechAnalysisResult, options?: CoachingOptions): Promise<CoachingPlan>;
};

export type SpeechCoachingPipelineOptions = CoachingOptions & {
  sttProvider?: SttProvider;
  analysisProvider?: SpeechAnalysisProvider;
  coachingProvider?: CoachingProvider;
  sttOptions?: SttOptions;
};
