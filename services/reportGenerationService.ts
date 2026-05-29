import { causeDefinitions } from "@/services/causeInferenceService";
import type { CauseCandidate, FeatureReport, SpeechReport } from "@/types/speech";

export function createReportSummary(input: {
  featureReport: FeatureReport;
  causeCandidates: CauseCandidate[];
  fillerTotal: number;
  repeatedCount: number;
  clarityScore: number;
  lexicalDiversityScore: number;
}) {
  const top = input.causeCandidates.map((candidate) => candidate.label).join(", ");
  const fallback = "이번 녹음에서는 특정 원인이 강하게 나타나지는 않았습니다. 다만 아래 개선 포인트를 참고해보세요.";
  const summary = top
    ? `이번 녹음에서는 ${top}가 상대적으로 높게 관찰되었습니다. 문제로 단정하기보다, 맥락과 자기보고를 함께 반영한 개선 후보로 보는 것이 좋습니다.`
    : fallback;
  const goodPoints = buildGoodPoints(input);
  const nextGoal = buildNextGoal(input.causeCandidates[0]?.type, input.featureReport);
  return { summary, goodPoints, nextGoal };
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

function buildGoodPoints(input: {
  featureReport: FeatureReport;
  fillerTotal: number;
  repeatedCount: number;
  clarityScore: number;
  lexicalDiversityScore: number;
}) {
  const points: string[] = [];
  if (input.clarityScore >= 75) points.push("핵심 의미 전달의 명료도가 비교적 안정적이었습니다.");
  if (input.lexicalDiversityScore >= 65) points.push("어휘 다양성이 일정 수준 이상 유지되었습니다.");
  if (input.featureReport.structureFeatures.prepScore >= 0.5) points.push("주장, 이유, 예시 또는 결론 단서가 일부 확인되었습니다.");
  if (input.fillerTotal <= 3) points.push("filler 사용이 과도하게 두드러지지는 않았습니다.");
  if (points.length < 2) points.push("녹음을 완료하고 자기보고까지 남겨 다음 비교 기준을 만들었습니다.");
  if (points.length < 2) points.push("개선할 지점이 명확하게 잡혀 다음 훈련 목표를 세우기 좋습니다.");
  return points.slice(0, 2);
}

function buildNextGoal(type: SpeechReport["causeCandidates"][number]["type"] | undefined, featureReport: FeatureReport) {
  if (!type) return "다음 녹음에서는 첫 문장에 핵심 메시지를 더 일찍 배치해보세요.";
  const firstTraining = causeDefinitions[type].training[0];
  if (type === "delivery_regulation" && featureReport.deliveryFeatures.pauseLackScore > 0.4) return "다음 녹음에서는 문장 사이 pause를 의식적으로 2회 이상 넣어보세요.";
  return `다음 녹음에서는 ${firstTraining}을 1회 적용해보세요.`;
}
