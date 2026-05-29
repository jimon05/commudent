import { mockTranscript } from "@/lib/mockData";

export type SttInput = {
  audioBlob?: Blob;
  durationSeconds: number;
};

export type SttResult = {
  transcript: string;
  provider: "openai" | "mock";
  warning?: string;
};

export async function transcribeAudio(input: SttInput): Promise<SttResult> {
  if (!input.audioBlob) {
    return {
      transcript: mockTranscript,
      provider: "mock",
      warning: "녹음 파일이 없어 개발용 mock transcript로 분석했습니다."
    };
  }

  const formData = new FormData();
  formData.append("audio", input.audioBlob, "speech-practice.webm");
  formData.append("durationSeconds", String(input.durationSeconds));

  try {
    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData
    });
    const payload = (await response.json()) as Partial<SttResult> & { error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "STT 요청에 실패했습니다.");
    }

    return {
      transcript: payload.transcript || mockTranscript,
      provider: payload.provider === "openai" ? "openai" : "mock",
      warning: payload.warning
    };
  } catch (error) {
    return {
      transcript: mockTranscript,
      provider: "mock",
      warning: error instanceof Error ? error.message : "STT 연결 실패로 개발용 mock transcript를 사용했습니다."
    };
  }
}
