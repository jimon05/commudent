import type { SpeechReport } from "@/types/speech";

export const contextLabels = {
  formal: "공식 발표",
  informal: "비공식 발표",
  presentation: "발표 연습",
  interview: "면접",
  class: "수업 발표",
  meeting: "회의",
  daily: "일상 대화",
  other: "기타"
} as const;

export const mockTranscript =
  "오늘 발표의 핵심은 Commudent가 발표를 평가하는 도구가 아니라 발표 경험을 성장 데이터로 바꾸는 플랫폼이라는 점입니다. 사용자는 발표 자체를 못하는 것이 아니라, 자신이 의도한 메시지가 실제로 얼마나 전달됐는지 확인하기 어렵습니다. 그래서 발표 전에는 자료와 대본에서 핵심 메시지를 정리하고, 발표 후에는 녹음과 transcript를 바탕으로 다음 발표에 이어질 인사이트를 저장해야 합니다.";

export const mockReport: SpeechReport = {
  id: "demo-report",
  recordingId: "demo-recording",
  title: "MVP 소개 발표 연습",
  contextType: "formal",
  script: "Commudent는 발표를 분석하는 서비스가 아니라 발표 경험을 성장 데이터로 전환하는 서비스입니다. 발표 전 핵심 메시지를 정리하고, 발표 후 실제 전달도를 확인해 다음 발표 준비로 연결합니다.",
  slides: "1. 문제 정의: 발표 후 피드백이 단절됨\n2. 해결 방향: 핵심 메시지 전달도 분석\n3. 성장 데이터: 다음 발표에 이어지는 기록",
  timeLimit: 5,
  extractedKeyMessages: [
    "Commudent는 발표 평가가 아니라 발표 경험을 성장 데이터로 전환한다.",
    "핵심 문제는 발화 습관보다 의도한 메시지의 실제 전달 여부다.",
    "발표 전 준비와 발표 후 회고가 하나의 이력으로 이어져야 한다."
  ],
  overallDeliveryGoal: "청중이 발표 후 Commudent를 '발표 경험을 성장 데이터로 바꾸는 서비스'로 기억하도록 전달합니다.",
  slideDeliveryFeedback: [
    {
      slideIndex: 1,
      slideTitle: "문제 정의",
      expectedMessage: "발표 후 피드백이 다음 발표로 이어지지 않는 것이 핵심 문제다.",
      status: "partial",
      evidence: "문제 상황은 설명됐지만 청중이 기억할 한 문장으로 고정되지는 않았습니다.",
      suggestion: "[결론과 연결] 문제 슬라이드 마지막에 '그래서 발표 경험이 데이터로 남아야 합니다'를 덧붙이세요."
    },
    {
      slideIndex: 2,
      slideTitle: "해결 방향",
      expectedMessage: "핵심 메시지 전달도를 중심으로 발표를 분석한다.",
      status: "clear",
      evidence: "핵심 메시지와 전달도라는 표현이 transcript에서 분명히 확인됩니다.",
      suggestion: "[강조] 현재처럼 해결 방향을 서비스 정의와 같은 문장으로 반복하세요."
    },
    {
      slideIndex: 3,
      slideTitle: "성장 데이터",
      expectedMessage: "발표 결과가 다음 발표 준비로 이어져야 한다.",
      status: "weak",
      evidence: "발표 이력과 다음 준비의 연결이 짧게만 언급됐습니다.",
      suggestion: "[핵심 메시지 재강조] 마지막 슬라이드에서 다음 발표 준비 장면을 구체적으로 말하세요."
    }
  ],
  deliveryDimensionFeedback: [
    {
      dimension: "emphasis",
      label: "강조",
      feedback: "서비스 정의는 강조됐지만 성장 데이터 슬라이드의 결론 강조가 약했습니다.",
      suggestion: "[강조] '다음 발표로 이어진다'를 마지막 문장으로 다시 말하세요."
    },
    {
      dimension: "speed",
      label: "속도",
      feedback: "문제 정의에서 설명이 이어져 결론을 붙잡을 시간이 부족했습니다.",
      suggestion: "[잠깐 쉬기] 문제를 한 문장으로 말한 뒤 한 박자 멈추세요."
    },
    {
      dimension: "vocabulary",
      label: "어휘",
      feedback: "모호한 표현이 섞여 서비스 초점이 일부 흐려졌습니다.",
      suggestion: "[이 부분은 어휘 수정하기] '분석' 대신 '핵심 메시지 전달도 확인'을 사용하세요."
    }
  ],
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
    body: "핵심 메시지 전달 문제와 발표 이력 기반 접근을 설명합니다.",
    conclusion: "다음 발표 준비로 이어지는 성장 데이터를 결론으로 제시합니다.",
    keyMessagePosition: "early"
  },
  clarityScore: 78,
  structureScore: 74,
  deliveryScore: 82,
  messageResults: [
    {
      message: "Commudent는 발표 평가가 아니라 발표 경험을 성장 데이터로 전환한다.",
      status: "clear",
      evidence: "도입과 결론에서 같은 정의를 반복해 청중이 기억할 문장이 분명했습니다.",
      suggestion: "마지막 문장에서 서비스 정의를 한 번 더 짧게 재강조하세요."
    },
    {
      message: "핵심 문제는 의도한 메시지의 실제 전달 여부다.",
      status: "partial",
      evidence: "문제 정의는 나왔지만 청중이 기억할 결론 문장으로 충분히 고정되지는 않았습니다.",
      suggestion: "문제 정의 슬라이드에서는 '무엇을 말했는가'보다 '무엇이 기억됐는가'를 먼저 말하세요."
    },
    {
      message: "발표 전 준비와 발표 후 회고가 하나의 이력으로 이어져야 한다.",
      status: "weak",
      evidence: "기록 축적의 의미가 결론에만 짧게 등장했습니다.",
      suggestion: "발표 이력 화면 예시를 설명하며 다음 발표로 이어지는 장면을 구체화하세요."
    }
  ],
  sectionFeedback: [
    {
      section: "도입",
      feedback: "서비스의 새 정의가 빠르게 제시되어 방향은 명확했습니다.",
      suggestion: "[강조] '성장 데이터'라는 표현을 첫 20초 안에 한 번 더 말하세요."
    },
    {
      section: "문제 정의",
      feedback: "발화 습관과 메시지 전달 문제의 차이가 일부 섞였습니다.",
      suggestion: "[잠깐 쉬기] 문제를 한 문장으로 정리한 뒤 사례로 넘어가세요."
    },
    {
      section: "결론",
      feedback: "다음 발표 준비로 이어지는 가치가 약하게 전달됐습니다.",
      suggestion: "[핵심 메시지 재강조] 발표가 끝나도 데이터가 남는다는 점을 결론과 연결하세요."
    }
  ],
  revisedScript:
    "[강조] Commudent는 발표를 평가하는 서비스가 아니라, 발표 경험을 성장 데이터로 전환하는 서비스입니다.\n\n사용자가 어려워하는 것은 발표 자체가 아니라, 내가 의도한 핵심 메시지가 실제로 청중에게 어떻게 남았는지 확인하는 일입니다. [잠깐 쉬기]\n\n그래서 Commudent는 발표 전에는 대본과 자료에서 핵심 메시지 3개를 정리하고, 발표 후에는 녹음과 transcript를 바탕으로 각 메시지의 전달 상태를 분석합니다. [이 부분은 어휘 수정하기] 모호한 표현은 핵심 메시지를 흐리지 않는 구체어로 바꿉니다.\n\n[핵심 메시지 재강조] 결국 중요한 것은 발표가 끝난 뒤 피드백이 사라지지 않고, 다음 발표 준비로 이어지는 것입니다. [결론과 연결] Commudent는 발표라는 단발성 이벤트를 사용자의 성장 과정으로 남깁니다.",
  savedInsights: [
    "이번 발표에서는 문제 정의보다 서비스 정의가 더 선명하게 전달되었습니다.",
    "결론 강조가 약해 다음 발표에서는 마지막 30초에 핵심 메시지를 재진술해야 합니다."
  ],
  nextFocus: "다음 발표에서는 근거 설명 뒤 결론을 짧게 다시 말하는 구조를 유지하세요.",
  feedbackSummary: "이번 발표는 서비스의 새 정의는 명확했지만, 세 번째 핵심 메시지인 '다음 발표로 이어지는 기록'이 충분히 강조되지 않았습니다.",
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
      label: "핵심 내용 압축 필요",
      probability: 72,
      evidence: ["긴 문장 안에서 자기수정이 발생했습니다.", "중간 pause가 함께 나타났습니다."],
      caution: "현재 데이터만으로 발표 불안이나 인지부하를 확정할 수는 없습니다."
    },
    {
      type: "discourse_structure",
      label: "결론 연결 보강 필요",
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
  improvedVersion: "Commudent는 발표를 평가하는 서비스가 아니라 발표 경험을 성장 데이터로 전환하는 서비스입니다. 발표자는 자신이 의도한 핵심 메시지가 실제로 얼마나 전달됐는지 확인하기 어렵습니다. Commudent는 발표 전 핵심 메시지를 정리하고 발표 후 전달 상태를 분석해, 그 결과가 다음 발표 준비로 이어지도록 돕습니다.",
  weeklyTrend: {
    averageWpm: 108,
    fillerChangePercent: -18,
    pauseChangePercent: 12,
    structureScore: 74,
    clarityScore: 78,
    patternSummary: "발표 상황에서 filler와 속도 변화가 함께 증가하는 패턴이 반복됩니다."
  }
};
