import type { CoachingPlan, ScriptCoachResult, SpeechReport, TrainingType } from "@/types/speech";

const trainingLabels: Record<TrainingType, string> = {
  pause_replacement: "Pause Replacement Training",
  slow_speech: "Slow Speech Training",
  structure_training: "Structure Training",
  anxiety_training: "Anxiety Training",
  script_delivery: "Script Delivery Coaching"
};

export function getTrainingLabel(type: TrainingType) {
  return trainingLabels[type];
}

export function createCoachingPlan(report: SpeechReport): CoachingPlan {
  const recommended = new Set<TrainingType>();

  if (Object.values(report.fillerCounts).reduce((sum, count) => sum + count, 0) >= 3) recommended.add("pause_replacement");
  if (report.wpm > 130) recommended.add("slow_speech");
  if (report.structureScore < 80 || report.longSentences.length > 0) recommended.add("structure_training");
  if (report.causeCandidates.some((candidate) => candidate.type === "anxiety_pressure")) recommended.add("anxiety_training");
  recommended.add("script_delivery");

  return {
    recommendedTraining: Array.from(recommended),
    actionItems: [
      "첫 문장을 12초 안에 끝나는 고정 문장으로 다시 작성하기",
      "filler가 나오려는 순간 1초 침묵으로 대체하기",
      "PREP 구조로 핵심 메시지를 4문장 요약하기",
      "다음 녹음 후 같은 지표가 줄었는지 비교하기"
    ],
    nextPracticePrompt: "Point-Reason-Example-Point 순서로 60초 안에 같은 내용을 다시 설명해보세요."
  };
}

export function createImprovedVersion(transcript: string) {
  return transcript
    .replaceAll("음 ", "")
    .replaceAll("어 ", "")
    .replaceAll("약간 ", "")
    .replaceAll("그니까 ", "")
    .replaceAll("뭔가 ", "")
    .replace("저는 이 문제를 해결하기 위해서 말하기 데이터를 지속적으로 분석하고, 아니 발표 전후의 상태까지 함께 보는 방식이 필요하다고 봅니다.", "이 문제를 해결하려면 말하기 데이터와 발표 전후의 자기보고 데이터를 함께 분석해야 합니다.")
    .replace("그리고 마지막으로", "마지막으로");
}

export function coachScript(script: string): ScriptCoachResult {
  const sentences = script.split(/[.!?。？！\n]+/).map((item) => item.trim()).filter(Boolean);
  const estimatedSeconds = Math.max(20, Math.round((script.split(/\s+/).filter(Boolean).length / 115) * 60));
  const keyMessage = sentences.find((sentence) => /핵심|결론|중요|필요/.test(sentence)) ?? sentences[0] ?? "";

  return {
    original: script,
    improved: createImprovedVersion(script),
    keyMessage,
    prepChecklist: [
      { label: "Point", present: /제 생각|저는|핵심|결론|주장/.test(script) },
      { label: "Reason", present: /왜냐하면|이유|때문/.test(script) },
      { label: "Example", present: /예를 들면|예시|사례/.test(script) },
      { label: "Point Return", present: /따라서|그래서|결론적으로|다시 말해|마지막으로/.test(script) }
    ],
    emphasisSentences: sentences.slice(0, 2),
    pauseSuggestions: sentences.slice(0, 4).map((sentence) => `${sentence.slice(0, 32)}${sentence.length > 32 ? "..." : ""} 이후 1초 쉬기`),
    longSentenceFixes: sentences
      .filter((sentence) => sentence.length > 48)
      .slice(0, 3)
      .map((sentence) => ({
        before: sentence,
        after: sentence.replace(/,?\s*그리고\s*/g, ". 또한 ").replace(/하기 위해서/g, "하려면")
      })),
    expressionSuggestions: ["약간 → 구체적으로", "뭔가 → 핵심은", "좋다 → 효과적이다", "많다 → 반복적으로 관찰된다"],
    estimatedSeconds
  };
}
