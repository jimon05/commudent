import { causeDefinitions } from "@/services/causeInferenceService";
import type { CauseCandidate, CauseType, CoachingPlan, TrainingType } from "@/types/speech";

const causeTrainingMap: Record<CauseType, TrainingType[]> = {
  anxiety_pressure: ["anxiety_training"],
  cognitive_load: ["structure_training"],
  discourse_structure: ["structure_training"],
  habitual_pattern: ["pause_replacement"],
  delivery_regulation: ["slow_speech"]
};

export function createTrainingRecommendations(candidates: CauseCandidate[]): CoachingPlan {
  const top = candidates.length ? candidates : [];
  const recommended = new Set<TrainingType>();
  top.forEach((candidate) => causeTrainingMap[candidate.type].forEach((training) => recommended.add(training)));
  if (recommended.size === 0) recommended.add("structure_training");

  return {
    recommendedTraining: Array.from(recommended),
    actionItems: buildActionItems(top),
    nextPracticePrompt: buildNextPrompt(top[0]?.type)
  };
}

export function trainingRowsForStorage(candidates: CauseCandidate[]) {
  return candidates.flatMap((candidate) =>
    causeDefinitions[candidate.type].training.map((training) => ({
      targetCause: candidate.type,
      recommendedTraining: training,
      reason: `${candidate.label} ${candidate.level ?? ""}: ${candidate.evidence[0] ?? "관련 feature 조합이 관찰되었습니다."}`.trim()
    }))
  );
}

function buildActionItems(candidates: CauseCandidate[]) {
  if (!candidates.length) {
    return ["이번 녹음에서는 특정 원인이 강하게 나타나지 않았습니다.", "가장 긴 문장 하나를 2문장으로 나누어 다시 녹음해보세요.", "다음 녹음에서도 같은 지표가 유지되는지 확인하세요."];
  }
  const items = candidates.flatMap((candidate) => causeDefinitions[candidate.type].training.slice(0, 2));
  return Array.from(new Set(items)).slice(0, 4);
}

function buildNextPrompt(type?: CauseType) {
  if (type === "anxiety_pressure") return "첫 문장을 고정한 뒤 20초 동안 천천히 시작하는 녹음을 해보세요.";
  if (type === "cognitive_load") return "말하기 전 3초 동안 키워드 3개를 정하고 45초 안에 설명해보세요.";
  if (type === "discourse_structure") return "Point-Reason-Example-Point 순서로 60초 안에 같은 내용을 다시 설명해보세요.";
  if (type === "habitual_pattern") return "자주 나온 filler가 떠오르는 순간 1초 침묵으로 대체해보세요.";
  if (type === "delivery_regulation") return "문장마다 의도적으로 pause를 넣고 110-150 어절/분 속도로 다시 말해보세요.";
  return "핵심 메시지를 첫 문장에 두고 45초 안에 다시 말해보세요.";
}
