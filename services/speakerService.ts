import type { SpeakerSegment } from "@/types/speech";

export type VoiceEnrollmentInput = {
  userId: string;
  audioUrl: string | null;
  durationSeconds: number;
};

export async function enrollVoiceProfileMock(input: VoiceEnrollmentInput) {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return {
    voiceEmbeddingId: `mock-voice-${input.userId}-${Math.max(30, input.durationSeconds)}`,
    enrollmentStatus: "mock_enrolled" as const
  };
}

export async function splitSpeakersMock(input: {
  recordingId: string;
  transcript: string;
  userSpeakerId?: string;
}): Promise<SpeakerSegment[]> {
  const sentences = input.transcript.split(/[.!?。？！]+/).map((item) => item.trim()).filter(Boolean);
  return sentences.map((sentence, index) => ({
    id: `${input.recordingId}-segment-${index}`,
    recordingId: input.recordingId,
    speakerLabel: index % 5 === 4 ? "other_speaker" : input.userSpeakerId ?? "user_speaker",
    isUserVoice: index % 5 !== 4,
    startTime: index * 8,
    endTime: index * 8 + 7,
    transcript: sentence,
    confidence: index % 5 === 4 ? 0.72 : 0.91
  }));
}

export function filterUserSpeech(segments: SpeakerSegment[]) {
  return segments.filter((segment) => segment.isUserVoice).map((segment) => segment.transcript).join(". ");
}
