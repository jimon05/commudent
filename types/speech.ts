export type ContextType = "presentation" | "interview" | "class" | "meeting" | "daily" | "other";

export type CauseType =
  | "anxiety_pressure"
  | "cognitive_load"
  | "discourse_structure"
  | "habitual_pattern"
  | "delivery_regulation";

export type TrainingType =
  | "pause_replacement"
  | "slow_speech"
  | "structure_training"
  | "anxiety_training"
  | "script_delivery";

export type PreSpeechSurveyInput = {
  nervousnessScore: number;
  preparednessScore: number;
  confidenceScore: number;
  conditionScore: number;
};

export type PostSpeechSelfCheckInput = {
  contextType: ContextType;
  nervousnessScore: number;
  perceivedDifficulty:
    | "긴장했다"
    | "생각이 정리되지 않았다"
    | "말이 빨랐다"
    | "단어가 떠오르지 않았다"
    | "같은 표현을 반복했다"
    | "특별한 어려움은 없었다";
  userNote?: string;
};

export type PausePoint = {
  position: number;
  durationSeconds: number;
  label: "short" | "medium" | "long";
};

export type RepeatedExpression = {
  expression: string;
  count: number;
};

export type LongSentence = {
  sentence: string;
  length: number;
};

export type SpeechReport = {
  id: string;
  recordingId: string;
  title: string;
  contextType: ContextType;
  transcript: string;
  durationSeconds: number;
  createdAt: string;
  audioUrl?: string | null;
  audioStoragePath?: string | null;
  sttProvider?: "openai" | "mock";
  analysisMode?: "live" | "development_fallback";
  featureReport?: FeatureReport;
  sentenceFeedback?: SentenceFeedback[];
  goodPoints?: string[];
  nextGoal?: string;
  postSpeechSelfCheck?: PostSpeechSelfCheckInput;
  lexicalReport?: LexicalReport;
  fillerCounts: Record<string, number>;
  pauseData: {
    count: number;
    averageLengthSeconds: number;
    points: PausePoint[];
  };
  repeatedExpressions: RepeatedExpression[];
  averageSentenceLength: number;
  longSentences: LongSentence[];
  wpm: number;
  selfCorrections: string[];
  structure: {
    intro: string;
    body: string;
    conclusion: string;
    keyMessagePosition: "early" | "middle" | "late" | "unclear";
  };
  clarityScore: number;
  structureScore: number;
  deliveryScore: number;
  feedbackSummary: string;
  causeScores: CauseScores;
  causeCandidates: CauseCandidate[];
  coachingPlan: CoachingPlan;
  improvedVersion: string;
  weeklyTrend: WeeklyTrend;
};

export type FeatureReport = {
  fluencyFeatures: FluencyFeatures;
  deliveryFeatures: DeliveryFeatures;
  structureFeatures: StructureFeatures;
  lexicalFeatures: LexicalFeatures;
  contextFeatures: ContextFeatures;
  normalizedFeatures: NormalizedFeatureScores;
};

export type FluencyFeatures = {
  fillerRatio: number;
  fillerScore: number;
  pauseScore: number;
  selfRepairScore: number;
  hesitationScore: number;
  earlyFillerScore: number;
  fillerCount: number;
  totalEojeolCount: number;
};

export type DeliveryFeatures = {
  speechRate: number;
  eojeolPerMinute: number;
  deliverySpeedScore: number;
  wpmVariabilityScore: number;
  sentenceLengthScore: number;
  clarityScore: number;
  clarityProblemScore: number;
  pauseLackScore: number;
};

export type StructureFeatures = {
  prepScore: number;
  prepFailureScore: number;
  keyMessagePosition: number;
  keyMessageDelayScore: number;
  topicDriftScore: number;
  structureProblemScore: number;
  discourseCoherenceScore: number;
};

export type LexicalFeatures = {
  ttr: number;
  simplifiedMtld: number;
  lexicalDiversityScore: number;
  vagueExpressionScore: number;
  repetitionScore: number;
  repeatedExpressionCount: number;
  expressionPrecisionScore: number;
};

export type ContextFeatures = {
  contextType: ContextType;
  presentationContextScore: number;
  nervousnessScore: number;
  postSpeechSelfCheck?: PostSpeechSelfCheckInput;
  onboardingSelfCheck?: Record<string, string | number | boolean>;
};

export type NormalizedFeatureScores = {
  filler_score: number;
  early_filler_score: number;
  pause_score: number;
  pause_lack_score: number;
  self_repair_score: number;
  hesitation_score: number;
  delivery_speed_score: number;
  wpm_variability_score: number;
  sentence_length_score: number;
  clarity_problem_score: number;
  prep_failure_score: number;
  key_message_delay_score: number;
  topic_drift_score: number;
  structure_problem_score: number;
  discourse_coherence_problem_score: number;
  lexical_diversity_problem_score: number;
  vague_expression_score: number;
  repetition_score: number;
  repeated_specific_filler_score: number;
  low_anxiety_filler_score: number;
  session_consistency_score: number;
  emphasis_problem_score: number;
  presentation_context_score: number;
  nervousness_score: number;
};

export type LexicalReport = {
  id?: string;
  recordingId: string;
  lexicalDiversityScore: number;
  repeatedGenericWords: Array<{ expression: string; count: number }>;
  recommendedExpressions: string[];
  summary: string;
  createdAt?: string;
};

export type SentenceFeedback = {
  original: string;
  detected_issue: string;
  improved_version: string;
  explanation: string;
  tone: "presentation" | "interview" | "meeting" | "conversation";
  source?: "gemini" | "openai" | "fallback";
};

export type CauseCandidate = {
  type: CauseType;
  alias?: keyof CauseScoreAliases;
  academicName?: string;
  references?: string[];
  label: string;
  probability: number;
  evidence: string[];
  influentialFeatures?: Array<{ label: string; value: number; weight: number }>;
  level?: "낮음" | "관찰됨" | "가능성 높음" | "강하게 나타남";
  caution: string;
};

export type CoachingPlan = {
  recommendedTraining: TrainingType[];
  actionItems: string[];
  nextPracticePrompt: string;
};

export type CauseFeedback = {
  selectedCauses: string[];
  userNote: string;
};

export type PrimaryGoal = "presentation" | "interview" | "meeting" | "daily" | "class_discussion" | "other";

export type MainPainPoint =
  | "fast_speech"
  | "many_fillers"
  | "disorganized"
  | "blank_mind"
  | "weak_delivery"
  | "too_long";

export type UserProfile = {
  id: string;
  userId: string;
  nickname: string;
  primaryGoal: PrimaryGoal;
  mainPainPoints: MainPainPoint[];
  createdAt: string;
};

export type VoiceProfile = {
  id: string;
  userId: string;
  sampleAudioUrl: string | null;
  sampleStoragePath?: string | null;
  voiceEmbeddingId: string;
  enrollmentStatus: "mock_enrolled" | "sample_saved" | "pending" | "failed" | "verified";
  createdAt: string;
};

export type OnboardingSelfCheck = {
  id: string;
  userId: string;
  answers: Record<string, string | number | boolean>;
  initialTypeScores: CauseScores;
  createdAt: string;
};

export type SpeakerSegment = {
  id: string;
  recordingId: string;
  speakerLabel: string;
  isUserVoice: boolean;
  startTime: number;
  endTime: number;
  transcript: string;
  confidence: number;
};

export type CauseScores = Record<CauseType, number>;

export type CauseScoreAliases = {
  anxiety: number;
  cognitive_load: number;
  discourse: number;
  habitual: number;
  delivery: number;
};

export type CauseInferenceResult = {
  scores: CauseScores;
  aliases: CauseScoreAliases;
  confidence: CauseScores;
  topCauses: CauseCandidate[];
  scoreExplanations: Record<CauseType, string[]>;
};

export type TrainingSession = {
  id: string;
  userId: string;
  trainingType: TrainingType;
  targetCause: CauseType;
  prompt: string;
  result: Record<string, string | number | boolean>;
  completedAt: string;
};

export type WeeklyTrend = {
  averageWpm: number;
  fillerChangePercent: number;
  pauseChangePercent: number;
  structureScore: number;
  clarityScore: number;
  patternSummary: string;
};

export type RecordingDraft = {
  title: string;
  contextType: ContextType;
  durationSeconds: number;
  survey: PreSpeechSurveyInput;
  postSpeechSelfCheck?: PostSpeechSelfCheckInput;
  audioBlob?: Blob;
  audioUrl?: string | null;
};

export type ScriptCoachResult = {
  original: string;
  improved: string;
  keyMessage: string;
  prepChecklist: Array<{ label: "Point" | "Reason" | "Example" | "Point Return"; present: boolean }>;
  emphasisSentences: string[];
  pauseSuggestions: string[];
  longSentenceFixes: Array<{ before: string; after: string }>;
  expressionSuggestions: string[];
  estimatedSeconds: number;
};
