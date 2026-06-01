import type { DeliveryDimensionFeedback, MessageResult, PresentationPrepAnalysis, PresentationSlide, SectionFeedback, SlideDeliveryFeedback, SpeechReport } from "@/types/speech";

const fallbackMessages = [
  "청중이 발표 후 기억해야 할 핵심 결론을 분명히 전달한다.",
  "문제와 근거가 결론으로 자연스럽게 이어지도록 설명한다.",
  "발표의 마지막에 핵심 메시지를 다시 강조한다."
];

export function createPresentationPlan(input: { script: string; slides: string }) {
  const slides = parseSlides(input.slides);
  const extractedKeyMessages = extractKeyMessages(input.script, input.slides);
  const plannedSlides = slides.length > 0 ? slides : fallbackSlides(extractedKeyMessages);
  const presentationSlides = plannedSlides.map((slide, index) => ({
    ...slide,
    expectedMessage: slide.expectedMessage || extractedKeyMessages[index] || extractedKeyMessages.at(-1) || fallbackMessages[index] || fallbackMessages[0]
  }));

  return {
    extractedKeyMessages,
    presentationSlides,
    overallDeliveryGoal: `청중이 발표 후 "${extractedKeyMessages[0]}"를 가장 먼저 떠올리도록 전달합니다.`
  };
}

export function createFallbackPrepAnalysis(input: {
  script: string;
  slides: string;
  priorReports?: Array<Pick<SpeechReport, "nextFocus" | "savedInsights" | "slideDeliveryFeedback" | "messageResults">>;
}): PresentationPrepAnalysis {
  const plan = createPresentationPlan(input);
  const weakSlide = input.priorReports
    ?.flatMap((report) => report.slideDeliveryFeedback ?? [])
    .find((item) => item.status !== "clear");
  const repeatedWeakness = weakSlide ? `${weakSlide.slideTitle} 구간에서 결론 강조가 부족했던 이력이 있습니다.` : "최근 발표 기록이 충분하지 않아 이번 발표의 핵심 메시지 전달 여부를 기준으로 저장합니다.";

  return {
    keyMessages: plan.extractedKeyMessages,
    slides: plan.presentationSlides,
    overallDeliveryGoal: plan.overallDeliveryGoal,
    emphasisPoints: [
      "결론은 도입과 마무리에서 같은 표현으로 반복하세요.",
      "수치, 비교, 문제 정의를 말할 때는 한 박자 늦춰 설명하세요.",
      "각 슬라이드 마지막에 청중이 기억할 문장을 한 번 더 말하세요."
    ],
    cautions: [
      repeatedWeakness,
      "근거와 사례가 길어질 때 핵심 주장보다 세부 내용이 먼저 기억될 수 있습니다.",
      "질문 응답에서는 답변의 첫 문장에 핵심 주장을 먼저 제시하세요."
    ]
  };
}

export function extractKeyMessages(script: string, slides = "") {
  const parsedSlides = parseSlides(slides);
  const slideMessages = parsedSlides
    .map((slide) => cleanClaim(slide.expectedMessage || slide.title || slide.content))
    .filter((item) => item.length > 8 && !isUploadPlaceholder(item));
  if (slideMessages.length >= 3) return pickSlideBackedMessages(slideMessages);

  const slideCandidates = parsedSlides.flatMap((slide) => [slide.expectedMessage, slide.title, slide.content]);
  const scriptCandidates = splitIntoClaims(script);
  const candidates = [...slideCandidates, ...scriptCandidates]
    .map((item) => cleanClaim(item))
    .filter((item) => item.length > 8 && !isUploadPlaceholder(item));
  const picked = pickMaterialBackedMessages(candidates);
  return [...picked, ...fallbackMessages].slice(0, 3);
}

export function analyzePresentationDelivery(input: {
  script?: string;
  slides?: string;
  transcript: string;
  extractedKeyMessages?: string[];
  fallbackSummary: string;
  deliveryScore: number;
}): Pick<
  SpeechReport,
  | "extractedKeyMessages"
  | "slideDeliveryFeedback"
  | "overallDeliveryGoal"
  | "deliveryDimensionFeedback"
  | "messageResults"
  | "sectionFeedback"
  | "revisedScript"
  | "savedInsights"
  | "nextFocus"
  | "feedbackSummary"
  | "deliveryScore"
> {
  const plan = createPresentationPlan({ script: input.script || input.transcript, slides: input.slides || "" });
  const extractedKeyMessages = input.extractedKeyMessages?.length ? input.extractedKeyMessages : plan.extractedKeyMessages;
  const transcript = input.transcript || "";
  const messageResults = buildMessageResults(extractedKeyMessages, transcript);
  const slideDeliveryFeedback = plan.presentationSlides.map((slide) => evaluateSlide(slide, transcript));
  const deliveryDimensionFeedback = buildDimensionFeedback({ transcript, slideDeliveryFeedback, deliveryScore: input.deliveryScore });
  const weakCount = [...messageResults, ...slideDeliveryFeedback].filter((item) => item.status === "weak").length;
  const partialCount = [...messageResults, ...slideDeliveryFeedback].filter((item) => item.status === "partial").length;
  const deliveryScore = scoreDelivery({ messageResults, slideDeliveryFeedback, baseScore: input.deliveryScore });

  return {
    extractedKeyMessages,
    slideDeliveryFeedback,
    overallDeliveryGoal: plan.overallDeliveryGoal,
    deliveryDimensionFeedback,
    messageResults,
    sectionFeedback: buildSectionFeedback({ messageResults, slideDeliveryFeedback, partialCount, weakCount }),
    revisedScript: buildRevisedScript(input.script || input.transcript, extractedKeyMessages, slideDeliveryFeedback),
    savedInsights: [
      weakCount > 0 ? "슬라이드별 핵심 내용 중 일부가 발표 transcript에서 충분히 회수되지 않았습니다." : "발표 전체의 핵심 내용이 transcript에 안정적으로 남았습니다.",
      partialCount > 0 ? "강조 문장과 결론 연결 문장을 슬라이드 전환부에 추가하면 전달도가 올라갑니다." : "슬라이드 전환과 전체 결론의 연결이 비교적 자연스럽습니다."
    ],
    nextFocus: weakCount > 0 ? "다음 연습에서는 각 슬라이드가 끝날 때 핵심 문장을 한 번씩 다시 말하세요." : "다음 발표에서는 현재 핵심 메시지 구조를 유지하되 사례 설명을 더 압축하세요.",
    feedbackSummary:
      weakCount > 0
        ? `슬라이드/전체 핵심 내용 중 ${weakCount}개가 전달 부족으로 평가되었습니다. 다음 연습에서는 강조, 속도, 어휘를 핵심 메시지 전달을 돕는 방향으로 조정하세요.`
        : input.fallbackSummary,
    deliveryScore
  };
}

function parseSlides(slides: string): PresentationSlide[] {
  return slides
    .split(/\n(?=\s*(?:\d+[\).:-]|[-*]\s|(?:slide|슬라이드)\s*\d+))/i)
    .map((chunk, index) => {
      const lines = chunk.split("\n").map((line) => cleanLine(line)).filter(Boolean);
      const rawTitle = lines[0] ?? `슬라이드 ${index + 1}`;
      const title = rawTitle.replace(/^(?:\d+[\).:-]\s*|[-*]\s*|(?:slide|슬라이드)\s*\d+[:.)-]?\s*)/i, "") || `슬라이드 ${index + 1}`;
      const content = lines.slice(1).join(" ") || title;
      return {
        index: index + 1,
        title,
        content,
        expectedMessage: pickExpectedMessage(`${title}. ${content}`)
      };
    })
    .filter((slide) => slide.title || slide.content);
}

function fallbackSlides(messages: string[]): PresentationSlide[] {
  return messages.map((message, index) => ({
    index: index + 1,
    title: `핵심 구간 ${index + 1}`,
    content: message,
    expectedMessage: message
  }));
}

function pickExpectedMessage(text: string) {
  const claims = splitIntoClaims(text).map((item) => cleanClaim(item)).filter((item) => item.length > 8);
  return claims.sort((a, b) => claimScore(b) - claimScore(a))[0] ?? cleanClaim(text);
}

function splitIntoClaims(value: string) {
  return value
    .split(/[\n.!?。？！•·]/)
    .flatMap((line) => line.split(/\s{2,}|;\s*/))
    .map((item) => cleanLine(item))
    .filter(Boolean);
}

function pickMaterialBackedMessages(candidates: string[]) {
  const unique = candidates.filter((item, index, array) => array.findIndex((candidate) => similarPrefix(candidate, item)) === index);
  const categories = [
    /문제|한계|부족|어려움|병목|불확실|단절|필요|위험|pain|problem/i,
    /해결|제안|솔루션|서비스|전략|방법|모델|플랫폼|개선|지원|solution/i,
    /결론|가치|효과|성장|향상|전환|기대|성과|확장|임팩트|benefit|impact/i
  ];
  const picked: string[] = [];

  categories.forEach((pattern) => {
    const match = unique.filter((item) => pattern.test(item)).sort((a, b) => claimScore(b) - claimScore(a))[0];
    if (match && !picked.some((item) => similarPrefix(item, match))) picked.push(match);
  });

  unique
    .sort((a, b) => claimScore(b) - claimScore(a))
    .forEach((item) => {
      if (picked.length < 3 && !picked.some((candidate) => similarPrefix(candidate, item))) picked.push(item);
    });

  return picked.map(toAudienceMessage).slice(0, 3);
}

function pickSlideBackedMessages(slideMessages: string[]) {
  const unique = slideMessages.filter((item, index, array) => array.findIndex((candidate) => similarPrefix(candidate, item)) === index);
  const categories = [
    /시장|배경|성장|현황|규모|변화|트렌드|왜|필요/i,
    /문제|한계|부족|어려움|병목|불확실|단절|위험|pain|problem/i,
    /해결|제안|솔루션|서비스|전략|방법|모델|플랫폼|개선|지원|가치|효과|결론|solution/i
  ];
  const selected: string[] = [];

  categories.forEach((pattern) => {
    const match = unique.find((item) => pattern.test(item));
    if (match && !selected.some((item) => similarPrefix(item, match))) selected.push(match);
  });

  unique.forEach((item) => {
    if (selected.length < 3 && !selected.some((candidate) => similarPrefix(candidate, item))) selected.push(item);
  });

  return selected
    .slice(0, 3)
    .sort((a, b) => unique.indexOf(a) - unique.indexOf(b))
    .map(toAudienceMessage);
}

function toAudienceMessage(value: string) {
  const cleaned = cleanClaim(value);
  if (/^(문제|해결|가치|결론|배경|목표)\s*[:：]/.test(cleaned)) return cleaned.replace(/^(문제|해결|가치|결론|배경|목표)\s*[:：]\s*/, "");
  return cleaned;
}

function claimScore(value: string) {
  const keywordScore = (value.match(/핵심|문제|결론|성장|전달|사용자|서비스|데이터|발표|효과|가치|해결|제안|시장|비용|정확도|전환/g) ?? []).length * 8;
  const lengthScore = Math.min(value.length, 90) / 6;
  const penalty = value.length > 150 ? 12 : 0;
  return keywordScore + lengthScore - penalty;
}

function similarPrefix(a: string, b: string) {
  return cleanClaim(a).slice(0, 18) === cleanClaim(b).slice(0, 18);
}

function cleanClaim(value: string) {
  return cleanLine(value)
    .replace(/^(?:slide|슬라이드)\s*\d+[:.)-]?\s*/i, "")
    .replace(/^\d+[\).:-]\s*/, "")
    .replace(/^[-*]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUploadPlaceholder(value: string) {
  return /파일이 선택되었습니다|텍스트를 자동 추출하지 못했습니다|입력칸에 붙여넣어 주세요|PDF\/PPT 파일/.test(value);
}

function buildMessageResults(messages: string[], transcript: string): MessageResult[] {
  return messages.map((message, index) => {
    const status = statusFromOverlap(keywordOverlap(message, transcript));
    return {
      message,
      status,
      evidence: evidenceForStatus(status, "발표 전체"),
      suggestion: [
        "[강조] 도입과 결론에서 같은 문장으로 한 번 더 말하세요.",
        "[잠깐 쉬기] 근거 설명 뒤 결론을 짧게 연결하세요.",
        "[핵심 메시지 재강조] 마지막 슬라이드에서 청중이 기억할 문장을 다시 제시하세요."
      ][index] ?? "[핵심 메시지 재강조] 청중이 가져갈 문장을 다시 말하세요."
    };
  });
}

function evaluateSlide(slide: PresentationSlide, transcript: string): SlideDeliveryFeedback {
  const status = statusFromOverlap(keywordOverlap(`${slide.title} ${slide.expectedMessage}`, transcript));
  return {
    slideIndex: slide.index,
    slideTitle: slide.title,
    expectedMessage: slide.expectedMessage,
    status,
    evidence: evidenceForStatus(status, `${slide.index}번 슬라이드`),
    suggestion:
      status === "clear"
        ? "[강조] 현재처럼 슬라이드 결론을 분명히 유지하세요."
        : status === "partial"
          ? "[결론과 연결] 이 슬라이드가 전체 발표 결론에 왜 필요한지 한 문장 덧붙이세요."
          : "[핵심 메시지 재강조] 슬라이드 마지막에 청중이 기억할 문장을 그대로 말하세요."
  };
}

function buildDimensionFeedback(input: { transcript: string; slideDeliveryFeedback: SlideDeliveryFeedback[]; deliveryScore: number }): DeliveryDimensionFeedback[] {
  const weakSlides = input.slideDeliveryFeedback.filter((item) => item.status !== "clear");
  const hasVagueWords = /뭔가|약간|좋은|많은|느낌|부분/.test(input.transcript);
  return [
    {
      dimension: "emphasis",
      label: "강조",
      feedback: weakSlides.length > 0 ? "일부 슬라이드의 결론 문장이 충분히 강조되지 않았습니다." : "핵심 문장이 발표 안에서 비교적 선명하게 반복되었습니다.",
      suggestion: weakSlides.length > 0 ? "[강조] 약한 슬라이드의 마지막 문장을 발표 전체 핵심 메시지와 같은 표현으로 마무리하세요." : "[핵심 메시지 재강조] 결론 슬라이드에서 같은 문장을 한 번 더 회수하세요."
    },
    {
      dimension: "speed",
      label: "속도",
      feedback: input.deliveryScore < 75 ? "핵심 문장 앞뒤에 쉬어가는 지점이 부족해 청중이 결론을 잡기 어려울 수 있습니다." : "전달 속도는 핵심 내용 이해를 크게 방해하지 않는 수준입니다.",
      suggestion: "[잠깐 쉬기] 핵심 문장 직전과 직후에 한 박자씩 멈추세요."
    },
    {
      dimension: "vocabulary",
      label: "어휘",
      feedback: hasVagueWords ? "일부 모호한 어휘가 핵심 메시지의 선명도를 낮출 수 있습니다." : "핵심 메시지를 흐리는 모호한 어휘는 크게 두드러지지 않았습니다.",
      suggestion: hasVagueWords ? "[이 부분은 어휘 수정하기] '부분/느낌/좋은' 같은 표현을 발표 주제의 구체 명사로 바꾸세요." : "[결론과 연결] 핵심 명사를 유지해 청중의 기억 단서를 만드세요."
    }
  ];
}

function buildSectionFeedback(input: {
  messageResults: MessageResult[];
  slideDeliveryFeedback: SlideDeliveryFeedback[];
  partialCount: number;
  weakCount: number;
}): SectionFeedback[] {
  const weakestSlide = input.slideDeliveryFeedback.find((item) => item.status === "weak" || item.status === "partial");
  return [
    {
      section: "발표 전체",
      feedback: input.messageResults[0]?.status === "clear" ? "발표의 전체 핵심 내용이 transcript에 분명히 남았습니다." : "발표 전체를 관통하는 핵심 문장이 더 선명해야 합니다.",
      suggestion: "[강조] 첫 20초 안에 발표 전체 결론을 한 문장으로 제시하세요."
    },
    {
      section: weakestSlide ? `${weakestSlide.slideIndex}번 슬라이드` : "슬라이드별 전달",
      feedback: weakestSlide ? `${weakestSlide.slideTitle} 구간의 핵심 내용 전달이 보완 대상입니다.` : "각 슬라이드의 핵심 내용이 비교적 고르게 전달되었습니다.",
      suggestion: weakestSlide?.suggestion ?? "[결론과 연결] 슬라이드 전환부에서 전체 결론과의 관계를 말하세요."
    },
    {
      section: "마무리",
      feedback: input.weakCount > 0 ? "청중이 마지막에 가져갈 결론이 더 선명해야 합니다." : "결론부에서 핵심 메시지를 다시 회수할 수 있습니다.",
      suggestion: input.partialCount > 0 ? "[핵심 메시지 재강조] 일부 전달된 메시지를 마지막 문장에서 다시 말하세요." : "[핵심 메시지 재강조] 발표의 한 줄 정의로 끝내세요."
    }
  ];
}

function buildRevisedScript(source: string, messages: string[], slideFeedback: SlideDeliveryFeedback[]) {
  const base = source.trim() || messages.join(" ");
  const weakSlideNotes = slideFeedback
    .filter((item) => item.status !== "clear")
    .map((item) => `[핵심 메시지 재강조] ${item.slideTitle}: ${item.expectedMessage}`)
    .slice(0, 2);
  return [
    `[강조] ${messages[0]}`,
    "",
    `${base.split(/[\n.!?。？！]/).map((item) => item.trim()).filter(Boolean).slice(0, 2).join(". ")}. [잠깐 쉬기]`,
    "",
    messages[1] ? `[결론과 연결] ${messages[1]}` : "",
    ...weakSlideNotes,
    messages[2] ? `[핵심 메시지 재강조] ${messages[2]}` : "",
    "",
    "[이 부분은 어휘 수정하기] 모호한 표현은 청중이 기억할 명사형 결론으로 바꾸세요."
  ].filter(Boolean).join("\n");
}

function scoreDelivery(input: { messageResults: MessageResult[]; slideDeliveryFeedback: SlideDeliveryFeedback[]; baseScore: number }) {
  const all = [...input.messageResults, ...input.slideDeliveryFeedback];
  if (!all.length) return input.baseScore;
  const points = all.reduce((sum, item) => sum + (item.status === "clear" ? 100 : item.status === "partial" ? 68 : 38), 0);
  return Math.round(points / all.length);
}

function statusFromOverlap(overlap: number): MessageResult["status"] {
  if (overlap >= 0.55) return "clear";
  if (overlap >= 0.25) return "partial";
  return "weak";
}

function evidenceForStatus(status: MessageResult["status"], label: string) {
  if (status === "clear") return `${label}의 핵심어가 발표 transcript 안에서 충분히 확인됩니다.`;
  if (status === "partial") return `${label}의 핵심어 일부는 등장했지만 결론 문장으로 고정되지는 않았습니다.`;
  return `${label}에서 의도한 핵심 내용과 직접 연결되는 표현이 부족했습니다.`;
}

function keywordOverlap(message: string, transcript: string) {
  const keywords = message
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  if (!keywords.length) return 0;
  const hit = keywords.filter((word) => transcript.includes(word)).length;
  return hit / keywords.length;
}

function cleanLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
