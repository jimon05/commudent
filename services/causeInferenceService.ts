import type {
  CauseCandidate,
  CauseInferenceResult,
  CauseScoreAliases,
  CauseScores,
  CauseType,
  FeatureReport,
  OnboardingSelfCheck
} from "@/types/speech";

export const causeDefinitions: Record<
  CauseType,
  { label: string; alias: keyof CauseScoreAliases; academicName: string; references: string[]; description: string; training: string[]; representativeQuote: string }
> = {
  anxiety_pressure: {
    label: "불안/평가압박 영향 가능성",
    alias: "anxiety",
    academicName: "Communication Apprehension",
    references: ["McCroskey (1977)", "Zhao (2022)"],
    description: "평가 상황에서 긴장으로 인해 발화 안정성이 흔들릴 가능성입니다.",
    representativeQuote: "알고는 있는데 발표하면 머리가 하얘져요.",
    training: ["Anxiety Start Routine", "첫 문장 고정 훈련", "발표 초반 20초 안정화 훈련"]
  },
  cognitive_load: {
    label: "인지부하 영향 가능성",
    alias: "cognitive_load",
    academicName: "Cognitive Load",
    references: ["Betz et al. (2023)", "Dinkar et al. (2023)"],
    description: "생각 정리와 정보 처리 부담으로 말이 끊기거나 수정될 가능성입니다.",
    representativeQuote: "생각은 많은데 말로 바로 정리가 안 돼요.",
    training: ["3초 구조화 후 말하기", "한 문장 요약 훈련", "키워드 3개 말하기"]
  },
  discourse_structure: {
    label: "언어구조 영향 가능성",
    alias: "discourse",
    academicName: "Discourse Organization",
    references: ["Discourse organization markers", "PREP structure coaching"],
    description: "생각을 전달 가능한 구조로 조직하는 데 부담이 있을 가능성입니다.",
    representativeQuote: "말하고 나면 제가 무슨 말을 한 건지 모르겠어요.",
    training: ["PREP Structure Training", "결론 먼저 말하기", "30초 핵심 메시지 훈련"]
  },
  habitual_pattern: {
    label: "자동습관 영향 가능성",
    alias: "habitual",
    academicName: "Habitual Speech Pattern",
    references: ["Filler habituation patterns", "Self-monitoring training"],
    description: "무의식적으로 굳어진 filler나 표현이 반복될 가능성입니다.",
    representativeQuote: "나도 모르게 계속 같은 말을 써요.",
    training: ["Pause Replacement Training", "반복 표현 줄이기", "금지어 챌린지"]
  },
  delivery_regulation: {
    label: "전달조절 영향 가능성",
    alias: "delivery",
    academicName: "Delivery Regulation",
    references: ["Speech rate and pause control", "Prosodic delivery coaching"],
    description: "청자 입장에서 속도, pause, 명료도 조절이 어려울 가능성입니다.",
    representativeQuote: "말은 했는데 전달이 잘 안 된 것 같아요.",
    training: ["Slow Speech Training", "pause 삽입 훈련", "핵심 단어 강조 훈련"]
  }
};

export function inferCauseScores(input: {
  featureReport: FeatureReport;
  onboardingSelfCheck?: OnboardingSelfCheck | Record<string, string | number | boolean> | null;
  hasUserVoiceProfile?: boolean;
}): CauseInferenceResult {
  const f = input.featureReport.normalizedFeatures;
  const onboardingBias = buildOnboardingBias(input.onboardingSelfCheck);

  const raw: CauseScores = {
    anxiety_pressure:
      0.25 * f.nervousness_score +
      0.2 * f.presentation_context_score +
      0.2 * f.early_filler_score +
      0.15 * f.wpm_variability_score +
      0.1 * f.self_repair_score +
      0.1 * f.hesitation_score,
    cognitive_load:
      0.25 * f.pause_score +
      0.2 * f.self_repair_score +
      0.2 * f.sentence_length_score +
      0.15 * f.hesitation_score +
      0.1 * f.topic_drift_score +
      0.1 * f.filler_score,
    discourse_structure:
      0.25 * f.structure_problem_score +
      0.2 * f.prep_failure_score +
      0.2 * f.key_message_delay_score +
      0.15 * f.repetition_score +
      0.1 * f.topic_drift_score +
      0.1 * f.clarity_problem_score,
    habitual_pattern:
      0.3 * f.filler_score +
      0.25 * f.repeated_specific_filler_score +
      0.2 * f.repetition_score +
      0.15 * f.low_anxiety_filler_score +
      0.1 * f.session_consistency_score,
    delivery_regulation:
      0.3 * f.delivery_speed_score +
      0.25 * f.pause_lack_score +
      0.15 * f.wpm_variability_score +
      0.15 * f.clarity_problem_score +
      0.1 * f.emphasis_problem_score +
      0.05 * f.sentence_length_score
  };

  const scores = (Object.fromEntries(
    (Object.entries(raw) as Array<[CauseType, number]>).map(([type, score]) => [type, clamp01(score + onboardingBias[type])])
  ) as CauseScores);
  const confidence = Object.fromEntries(
    (Object.entries(scores) as Array<[CauseType, number]>).map(([type, score]) => [type, clamp01(score + (input.hasUserVoiceProfile ? 0.06 : 0))])
  ) as CauseScores;
  const aliases: CauseScoreAliases = {
    anxiety: scores.anxiety_pressure,
    cognitive_load: scores.cognitive_load,
    discourse: scores.discourse_structure,
    habitual: scores.habitual_pattern,
    delivery: scores.delivery_regulation
  };
  const scoreExplanations = buildScoreExplanations(input.featureReport);
  const topCauses = (Object.entries(scores) as Array<[CauseType, number]>)
    .sort((a, b) => b[1] - a[1])
    .filter(([, score]) => score >= 0.35)
    .slice(0, 2)
    .map(([type, score]) => buildCandidate(type, score, input.featureReport, scoreExplanations[type]));

  return { scores, aliases, confidence, topCauses, scoreExplanations };
}

export function interpretCauseScore(score: number) {
  if (score < 0.3) return "낮음" as const;
  if (score < 0.5) return "관찰됨" as const;
  if (score < 0.7) return "가능성 높음" as const;
  return "강하게 나타남" as const;
}

function buildCandidate(type: CauseType, score: number, featureReport: FeatureReport, evidence: string[]): CauseCandidate {
  return {
    type,
    alias: causeDefinitions[type].alias,
    academicName: causeDefinitions[type].academicName,
    references: causeDefinitions[type].references,
    label: causeDefinitions[type].label,
    probability: Math.round(score * 100),
    level: interpretCauseScore(score),
    influentialFeatures: influentialFeatures(type, featureReport),
    evidence,
    caution: "현재 녹음과 자기보고에서 보이는 원인 후보입니다. 사용자를 단정하지 않고 다음 녹음의 변화와 함께 확인합니다."
  };
}

function buildScoreExplanations(featureReport: FeatureReport): Record<CauseType, string[]> {
  const f = featureReport.normalizedFeatures;
  return {
    anxiety_pressure: [
      "평가 맥락, 자기보고 긴장도, 초반 filler, 속도 변동, 자기수정, 망설임을 함께 반영했습니다.",
      `긴장도 ${formatScore(f.nervousness_score)}, 초반 filler ${formatScore(f.early_filler_score)}, 속도 변동 ${formatScore(f.wpm_variability_score)}`
    ],
    cognitive_load: [
      "긴 pause, 자기수정, 문장 길이, 망설임, topic drift, filler를 함께 반영했습니다.",
      `pause ${formatScore(f.pause_score)}, 자기수정 ${formatScore(f.self_repair_score)}, 문장 길이 ${formatScore(f.sentence_length_score)}`
    ],
    discourse_structure: [
      "PREP 실패, 핵심 메시지 지연, 반복 설명, topic drift, 명료도 저하를 함께 반영했습니다.",
      `구조 문제 ${formatScore(f.structure_problem_score)}, PREP 실패 ${formatScore(f.prep_failure_score)}, 핵심 지연 ${formatScore(f.key_message_delay_score)}`
    ],
    habitual_pattern: [
      "특정 filler 반복, 반복 표현, 낮은 긴장 상황의 filler, 세션 간 반복 패턴을 함께 반영했습니다.",
      `filler ${formatScore(f.filler_score)}, 특정 filler 반복 ${formatScore(f.repeated_specific_filler_score)}, 반복 표현 ${formatScore(f.repetition_score)}`
    ],
    delivery_regulation: [
      "말 속도, pause 부족, 속도 변동, 명료도, 문장 길이를 함께 반영했습니다.",
      `속도 문제 ${formatScore(f.delivery_speed_score)}, pause 부족 ${formatScore(f.pause_lack_score)}, 명료도 문제 ${formatScore(f.clarity_problem_score)}`
    ]
  };
}

function influentialFeatures(type: CauseType, featureReport: FeatureReport) {
  const f = featureReport.normalizedFeatures;
  const rows: Record<CauseType, Array<{ label: string; value: number; weight: number }>> = {
    anxiety_pressure: [
      { label: "nervousness_score", value: f.nervousness_score, weight: 0.25 },
      { label: "presentation_context_score", value: f.presentation_context_score, weight: 0.2 },
      { label: "early_filler_score", value: f.early_filler_score, weight: 0.2 },
      { label: "wpm_variability_score", value: f.wpm_variability_score, weight: 0.15 },
      { label: "self_repair_score", value: f.self_repair_score, weight: 0.1 },
      { label: "hesitation_score", value: f.hesitation_score, weight: 0.1 }
    ],
    cognitive_load: [
      { label: "pause_score", value: f.pause_score, weight: 0.25 },
      { label: "self_repair_score", value: f.self_repair_score, weight: 0.2 },
      { label: "sentence_length_score", value: f.sentence_length_score, weight: 0.2 },
      { label: "hesitation_score", value: f.hesitation_score, weight: 0.15 },
      { label: "topic_drift_score", value: f.topic_drift_score, weight: 0.1 },
      { label: "filler_score", value: f.filler_score, weight: 0.1 }
    ],
    discourse_structure: [
      { label: "structure_problem_score", value: f.structure_problem_score, weight: 0.25 },
      { label: "prep_failure_score", value: f.prep_failure_score, weight: 0.2 },
      { label: "key_message_delay_score", value: f.key_message_delay_score, weight: 0.2 },
      { label: "repetition_score", value: f.repetition_score, weight: 0.15 },
      { label: "topic_drift_score", value: f.topic_drift_score, weight: 0.1 },
      { label: "clarity_problem_score", value: f.clarity_problem_score, weight: 0.1 }
    ],
    habitual_pattern: [
      { label: "filler_score", value: f.filler_score, weight: 0.3 },
      { label: "repeated_specific_filler_score", value: f.repeated_specific_filler_score, weight: 0.25 },
      { label: "repetition_score", value: f.repetition_score, weight: 0.2 },
      { label: "low_anxiety_filler_score", value: f.low_anxiety_filler_score, weight: 0.15 },
      { label: "session_consistency_score", value: f.session_consistency_score, weight: 0.1 }
    ],
    delivery_regulation: [
      { label: "delivery_speed_score", value: f.delivery_speed_score, weight: 0.3 },
      { label: "pause_lack_score", value: f.pause_lack_score, weight: 0.25 },
      { label: "wpm_variability_score", value: f.wpm_variability_score, weight: 0.15 },
      { label: "clarity_problem_score", value: f.clarity_problem_score, weight: 0.15 },
      { label: "emphasis_problem_score", value: f.emphasis_problem_score, weight: 0.1 },
      { label: "sentence_length_score", value: f.sentence_length_score, weight: 0.05 }
    ]
  };
  return rows[type].sort((a, b) => b.value * b.weight - a.value * a.weight).slice(0, 4);
}

function buildOnboardingBias(selfCheck: OnboardingSelfCheck | Record<string, string | number | boolean> | null | undefined): CauseScores {
  const answers = selfCheck && "answers" in selfCheck ? selfCheck.answers : selfCheck;
  const text = Object.values(answers ?? {}).join(" ");
  return {
    anxiety_pressure: textMatch(text, ["긴장", "머리가 하얘", "발표 긴장"]) ? 0.08 : 0,
    cognitive_load: textMatch(text, ["생각", "정리", "단어"]) ? 0.08 : 0,
    discourse_structure: textMatch(text, ["두서", "결론", "구조화", "길어"]) ? 0.08 : 0,
    habitual_pattern: textMatch(text, ["반복", "음/어/약간", "특정 표현"]) ? 0.08 : 0,
    delivery_regulation: textMatch(text, ["빠르", "전달", "말이 빠르다"]) ? 0.08 : 0
  };
}

function textMatch(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

function formatScore(value: number) {
  return `${Math.round(value * 100)}%`;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
