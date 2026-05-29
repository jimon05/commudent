import type { SpeechReport } from "@/types/speech";

export const contextLabels = {
  presentation: "발표 연습",
  interview: "면접",
  class: "수업 발표",
  meeting: "회의",
  daily: "일상 대화",
  other: "기타"
} as const;

export const mockTranscript =
  "음 저는 약간 이 서비스가 사용자 경험을 개선할 수 있다고 생각합니다. 그니까 지금은 사람들이 발표를 할 때 뭔가 자신의 말습관을 정확히 알기 어렵습니다. 저는 이 문제를 해결하기 위해서 말하기 데이터를 지속적으로 분석하고, 아니 발표 전후의 상태까지 함께 보는 방식이 필요하다고 봅니다. 핵심은 단순히 음이나 어를 세는 것이 아니라 왜 그런 표현이 나오는지 가능성을 좁혀가는 것입니다... 그리고 마지막으로 사용자가 바로 연습할 수 있는 훈련을 제공해야 합니다.";

export const mockReport: SpeechReport = {
  id: "demo-report",
  recordingId: "demo-recording",
  title: "MVP 소개 발표 연습",
  contextType: "presentation",
  transcript: mockTranscript,
  durationSeconds: 94,
  createdAt: "2026-05-27T09:00:00.000Z",
  fillerCounts: { "음": 1, "어": 0, "그니까": 1, "약간": 1, "뭔가": 1, "사실": 0, "이제": 0 },
  pauseData: {
    count: 3,
    averageLengthSeconds: 1.4,
    points: [
      { position: 64, durationSeconds: 1.1, label: "medium" },
      { position: 128, durationSeconds: 1.8, label: "long" },
      { position: 214, durationSeconds: 1.3, label: "medium" }
    ]
  },
  repeatedExpressions: [{ expression: "저는", count: 3 }],
  averageSentenceLength: 42,
  longSentences: [{ sentence: "저는 이 문제를 해결하기 위해서 말하기 데이터를 지속적으로 분석하고, 아니 발표 전후의 상태까지 함께 보는 방식이 필요하다고 봅니다.", length: 68 }],
  wpm: 102,
  selfCorrections: ["분석하고, 아니 발표 전후의 상태까지"],
  structure: {
    intro: "서비스가 사용자 경험을 개선할 수 있다는 주장으로 시작합니다.",
    body: "말습관 문제와 데이터 기반 접근을 설명합니다.",
    conclusion: "바로 연습 가능한 훈련 제공을 결론으로 제시합니다.",
    keyMessagePosition: "early"
  },
  clarityScore: 78,
  structureScore: 74,
  deliveryScore: 72,
  feedbackSummary: "현재 데이터에서는 인지부하와 언어구조 요인이 함께 나타날 가능성이 있습니다. 단정은 피하고, 다음 녹음에서 핵심 문장 선명도와 pause 대체 훈련을 우선 확인해보는 것이 좋습니다.",
  causeScores: {
    anxiety_pressure: 0.58,
    cognitive_load: 0.72,
    discourse_structure: 0.64,
    habitual_pattern: 0.48,
    delivery_regulation: 0.38
  },
  causeCandidates: [
    {
      type: "cognitive_load",
      label: "인지부하형 가능성",
      probability: 72,
      evidence: ["긴 문장 안에서 자기수정이 발생했습니다.", "중간 pause가 함께 나타났습니다."],
      caution: "현재 데이터만으로 발표 불안이나 인지부하를 확정할 수는 없습니다."
    },
    {
      type: "discourse_structure",
      label: "언어구조형 가능성",
      probability: 64,
      evidence: ["일부 문장이 길고 정보가 한 문장에 몰려 있습니다.", "반복 시작 표현이 관찰됩니다."],
      caution: "구조 문제라기보다 대본 숙련도 문제일 수도 있습니다."
    }
  ],
  coachingPlan: {
    recommendedTraining: ["pause_replacement", "structure_training", "script_delivery"],
    actionItems: ["첫 문장을 고정 문장으로 다시 말하기", "PREP 구조로 4문장 요약하기", "음/약간이 나오려는 순간 1초 침묵으로 바꾸기"],
    nextPracticePrompt: "이 서비스가 왜 필요한지 Point-Reason-Example-Point 순서로 60초 안에 설명해보세요."
  },
  improvedVersion: "저는 이 서비스가 발표자의 사용자 경험을 개선할 수 있다고 생각합니다. 발표자는 자신의 말습관을 정확히 알기 어렵기 때문에, 말하기 데이터와 자기보고 데이터를 함께 분석해야 합니다. 이 서비스는 원인을 단정하지 않고 가능성 높은 원인 후보를 제시한 뒤, 사용자가 바로 연습할 수 있는 맞춤 훈련을 제공합니다.",
  weeklyTrend: {
    averageWpm: 108,
    fillerChangePercent: -18,
    pauseChangePercent: 12,
    structureScore: 74,
    clarityScore: 78,
    patternSummary: "발표 상황에서 filler와 속도 변화가 함께 증가하는 패턴이 반복됩니다."
  }
};
