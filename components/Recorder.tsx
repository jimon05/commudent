"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { contextLabels } from "@/lib/mockData";
import { createAudioRecorder, mediaRecorderUnavailableMessage } from "@/services/audioRecording";
import { createSpeechReport } from "@/services/reports";
import type { ContextType, PreSpeechSurveyInput, PostSpeechSelfCheckInput } from "@/types/speech";
import { PreSpeechSurvey } from "@/components/PreSpeechSurvey";
import { PostRecordingSelfCheck } from "@/components/PostRecordingSelfCheck";

const contexts = Object.entries(contextLabels) as Array<[ContextType, string]>;

function formatSeconds(seconds: number) {
  const minute = Math.floor(seconds / 60).toString().padStart(2, "0");
  const second = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minute}:${second}`;
}

export function Recorder() {
  const router = useRouter();
  const [title, setTitle] = useState("AI 말습관 교정 서비스 소개");
  const [contextType, setContextType] = useState<ContextType>("presentation");
  const [survey, setSurvey] = useState<PreSpeechSurveyInput>({
    nervousnessScore: 4,
    preparednessScore: 3,
    confidenceScore: 3,
    conditionScore: 4
  });
  const [isRecording, setIsRecording] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSelfCheck, setShowSelfCheck] = useState(false);
  const [selfCheck, setSelfCheck] = useState<PostSpeechSelfCheckInput>({
    contextType: "presentation",
    nervousnessScore: 3,
    perceivedDifficulty: "특별한 어려움은 없었다",
    userNote: ""
  });
  const [selfCheckConfirmed, setSelfCheckConfirmed] = useState(false);
  const [statusMessage, setStatusMessage] = useState("녹음 후 실제 오디오 파일을 STT와 분석 파이프라인으로 전달합니다.");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(() => setDurationSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  const canUseMediaRecorder = useMemo(() => typeof window !== "undefined" && "MediaRecorder" in window && navigator.mediaDevices, []);

  async function startRecording() {
    setAudioUrl(null);
    setAudioBlob(null);
    setStatusMessage("마이크 입력을 녹음하고 있습니다.");
    setDurationSeconds(0);
    setSelfCheckConfirmed(false);
    setSelfCheck((current) => ({ ...current, contextType, nervousnessScore: survey.nervousnessScore }));
    chunksRef.current = [];

    if (canUseMediaRecorder) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = createAudioRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          setAudioBlob(blob);
          setAudioUrl(URL.createObjectURL(blob));
          setShowSelfCheck(true);
          setStatusMessage("녹음 파일이 준비되었습니다. 방금 녹음의 self-check를 입력하면 분석을 시작할 수 있습니다.");
          stream.getTracks().forEach((track) => track.stop());
        };
        recorder.start();
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "마이크 권한을 확인해 주세요.");
        setAudioUrl(null);
      }
    } else {
      setStatusMessage(mediaRecorderUnavailableMessage());
    }

    setIsRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (!canUseMediaRecorder) setShowSelfCheck(true);
  }

  async function analyze() {
    setIsAnalyzing(true);
    setStatusMessage("오디오 저장, STT, 말습관 분석을 순서대로 실행하고 있습니다.");
    try {
      const report = await createSpeechReport({
        title,
        contextType: selfCheck.contextType,
        durationSeconds: Math.max(durationSeconds, 1),
        survey,
        postSpeechSelfCheck: selfCheck,
        audioBlob: audioBlob ?? undefined,
        audioUrl
      });
      router.push(`/report/${report.id}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.");
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <PostRecordingSelfCheck
        isOpen={showSelfCheck}
        value={selfCheck}
        onChange={setSelfCheck}
        onConfirm={() => {
          setContextType(selfCheck.contextType);
          setSurvey((current) => ({ ...current, nervousnessScore: selfCheck.nervousnessScore }));
          setSelfCheckConfirmed(true);
          setShowSelfCheck(false);
          setStatusMessage("self-check가 반영되었습니다. 이제 STT와 분석을 시작할 수 있습니다.");
        }}
      />
      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-ink">녹음 설정</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">브라우저에서 녹음한 실제 오디오를 저장하고 STT/분석 파이프라인으로 전달합니다.</p>
          </div>
          <span className="rounded-md bg-teal-50 px-3 py-1 text-xs font-black text-marine">Live ready</span>
        </div>

        <label className="mt-5 block text-sm font-bold text-slate-700">
          연습 제목
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-line px-3 text-sm outline-none transition focus:border-marine focus:ring-2 focus:ring-teal-100"
          />
        </label>

        <div className="mt-5">
          <p className="text-sm font-bold text-slate-700">상황 선택</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {contexts.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setContextType(key)}
                className={`h-10 rounded-lg border px-3 text-sm font-bold transition ${
                  contextType === key ? "border-marine bg-teal-50 text-marine" : "border-line bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-slate-950 p-5 text-white">
          <div className="text-sm font-bold text-slate-300">녹음 시간</div>
          <div className="mt-2 text-5xl font-black tracking-normal">{formatSeconds(durationSeconds)}</div>
          <div className="mt-5 flex flex-wrap gap-3">
            {!isRecording ? (
              <button type="button" onClick={startRecording} className="h-11 rounded-lg bg-white px-5 text-sm font-black text-slate-950">
                녹음 시작
              </button>
            ) : (
              <button type="button" onClick={stopRecording} className="h-11 rounded-lg bg-rose-500 px-5 text-sm font-black text-white">
                녹음 종료
              </button>
            )}
            <button
              type="button"
              onClick={analyze}
              disabled={isRecording || isAnalyzing || !audioBlob || !selfCheckConfirmed}
              className="h-11 rounded-lg bg-teal-500 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {isAnalyzing ? "분석 중" : "분석 시작"}
            </button>
          </div>
          {audioUrl ? <audio controls src={audioUrl} className="mt-5 w-full" /> : null}
          {audioBlob && !selfCheckConfirmed ? (
            <button type="button" onClick={() => setShowSelfCheck(true)} className="mt-4 h-10 rounded-lg border border-teal-300/40 bg-teal-50 px-4 text-xs font-black text-marine">
              녹음 후 self-check 입력
            </button>
          ) : null}
          <p className="mt-4 text-xs font-semibold text-slate-400">{statusMessage}</p>
        </div>
      </section>

      <PreSpeechSurvey value={survey} onChange={setSurvey} />
    </div>
  );
}
