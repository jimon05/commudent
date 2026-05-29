import type {
  SpeechAudioInput,
  SpeechLanguage,
  SpeechTranscript,
  SttOptions,
  SttProvider,
  TranscriptSegment
} from "@/types/speechCoaching";

const DEFAULT_MOCK_TEXT =
  "안녕하세요. 오늘 발표에서는 문제 정의와 해결 방향, 그리고 다음 실행 계획을 차례로 말씀드리겠습니다.";

export const mockSttProvider: SttProvider = {
  async transcribe(input, options) {
    return createMockTranscript(input, options);
  }
};

export async function transcribeSpeech(
  input: SpeechAudioInput,
  options?: SttOptions,
  provider: SttProvider = mockSttProvider
): Promise<SpeechTranscript> {
  return provider.transcribe(input, options);
}

export function createMockTranscript(input: SpeechAudioInput, options?: SttOptions): SpeechTranscript {
  const text = resolveTranscriptText(input, options).trim();
  const language = options?.language ?? input.language ?? detectLanguage(text);
  const durationMs = resolveDurationMs(input, options, text);
  const segments = buildSegments(text, durationMs);
  const confidence = round(
    segments.reduce((sum, segment) => sum + segment.confidence, 0) / Math.max(segments.length, 1),
    2
  );

  return {
    id: `mock-transcript-${stableHash(`${input.type}:${text}:${durationMs}`)}`,
    text,
    language,
    durationMs,
    confidence,
    segments,
    sourceType: input.type
  };
}

function resolveTranscriptText(input: SpeechAudioInput, options?: SttOptions): string {
  if (options?.mockTranscriptText) return options.mockTranscriptText;
  if (input.type === "text") return input.text;
  if (input.type === "url") return buildPlaceholderText(input.audioUrl);
  return buildPlaceholderText(input.fileName);
}

function buildPlaceholderText(sourceName: string): string {
  const readableName = sourceName
    .split(/[/?#]/)
    .filter(Boolean)
    .at(-1)
    ?.replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();

  if (!readableName) return DEFAULT_MOCK_TEXT;
  return `${DEFAULT_MOCK_TEXT} 자료명은 ${readableName}입니다.`;
}

function resolveDurationMs(input: SpeechAudioInput, options: SttOptions | undefined, text: string): number {
  if (options?.durationMs) return options.durationMs;
  if (input.durationMs) return input.durationMs;

  const tokenCount = countSpeechTokens(text);
  const estimatedWordsPerMinute = detectLanguage(text) === "en" ? 135 : 115;
  return Math.max(3000, Math.round((tokenCount / estimatedWordsPerMinute) * 60_000));
}

function buildSegments(text: string, durationMs: number): TranscriptSegment[] {
  const clauses = text
    .split(/(?<=[.!?。！？])\s+|(?<=다\.)\s+|(?<=요\.)\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const safeClauses = clauses.length > 0 ? clauses : [text];
  const totalWeight = safeClauses.reduce((sum, clause) => sum + Math.max(countSpeechTokens(clause), 1), 0);
  let cursorMs = 0;

  return safeClauses.map((segmentText, index) => {
    const weight = Math.max(countSpeechTokens(segmentText), 1);
    const segmentDuration = index === safeClauses.length - 1
      ? durationMs - cursorMs
      : Math.round((durationMs * weight) / totalWeight);
    const startMs = cursorMs;
    const endMs = Math.max(startMs + 250, Math.min(durationMs, startMs + segmentDuration));
    cursorMs = endMs;

    return {
      id: `seg-${index + 1}`,
      text: segmentText,
      startMs,
      endMs,
      confidence: getSegmentConfidence(segmentText, index)
    };
  });
}

function getSegmentConfidence(text: string, index: number): number {
  const hesitationPenalty = /\b(um|uh|like)\b|음|어|저/.test(text.toLowerCase()) ? 0.08 : 0;
  return round(Math.max(0.72, 0.94 - hesitationPenalty - index * 0.01), 2);
}

function detectLanguage(text: string): SpeechLanguage {
  const hasHangul = /[가-힣]/.test(text);
  const hasLatin = /[a-z]/i.test(text);
  if (hasHangul && hasLatin) return "mixed";
  return hasHangul ? "ko" : "en";
}

function countSpeechTokens(text: string): number {
  const tokens = text
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return tokens.length;
}

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function round(value: number, digits: number): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}
