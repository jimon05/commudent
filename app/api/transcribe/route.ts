import { NextResponse } from "next/server";
import { mockTranscript } from "@/lib/mockData";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    provider: "openai",
    configured: Boolean(process.env.OPENAI_API_KEY),
    accepts: ["multipart/form-data field: audio", "multipart/form-data field: durationSeconds"],
    fallback: "OPENAI_API_KEY가 없으면 개발용 mock transcript를 반환합니다."
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!(audio instanceof File)) {
    return NextResponse.json(
      {
        transcript: mockTranscript,
        provider: "mock",
        warning: "오디오 파일이 없어 개발용 mock transcript를 반환했습니다."
      },
      { status: 200 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      transcript: mockTranscript,
      provider: "mock",
      warning: "OPENAI_API_KEY가 없어 개발용 mock transcript를 반환했습니다."
    });
  }

  const openAiForm = new FormData();
  openAiForm.append("file", audio, audio.name || "speech-practice.webm");
  openAiForm.append("model", "whisper-1");
  openAiForm.append("language", "ko");
  openAiForm.append("response_format", "json");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: openAiForm
  });

  const payload = (await response.json()) as { text?: string; error?: { message?: string } };

  if (!response.ok) {
    return NextResponse.json(
      {
        error: payload.error?.message ?? "OpenAI transcription 요청에 실패했습니다.",
        provider: "openai"
      },
      { status: response.status }
    );
  }

  return NextResponse.json({
    transcript: payload.text ?? "",
    provider: "openai"
  });
}
