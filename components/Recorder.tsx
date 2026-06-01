"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createAudioRecorder, mediaRecorderUnavailableMessage } from "@/services/audioRecording";
import { createSpeechReport, extractKeyMessages, listRecentReports } from "@/services/reports";
import type { ContextType, PostSpeechSelfCheckInput, PresentationPrepAnalysis, PresentationSlide, PreSpeechSurveyInput, SlideTranscript } from "@/types/speech";

type PrepStage = "input" | "analyzing" | "ready" | "practice" | "finished";

type FileExtractionResponse = {
  text?: string;
  warning?: string;
};

type UploadedPrepFile = {
  role: "slides" | "script";
  name: string;
  mimeType: string;
  dataBase64: string;
};

type PrepApiErrorResponse = {
  error?: string;
  message?: string;
  providerDetails?: {
    model?: string;
    status?: number;
    message?: string;
  };
};

type RichPrepFields = {
  audienceQuestions?: string[];
  rehearsalChecklist?: string[];
  timingPlan?: string[];
  openingLine?: string;
  closingLine?: string;
};

type RichPresentationPrepAnalysis = PresentationPrepAnalysis & RichPrepFields;

const prepRequestTimeoutMs = 45000;
const fileExtractionTimeoutMs = 25000;

function formatSeconds(seconds: number) {
  const minute = Math.floor(seconds / 60).toString().padStart(2, "0");
  const second = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minute}:${second}`;
}

function splitSlides(slides: string): PresentationSlide[] {
  return slides
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const content = item.replace(/^\s*(?:slide\s*)?\d+[\).:-]?\s*/i, "").trim() || item;
      const [rawTitle, ...rest] = content.split(":");
      const hasTitle = rest.length > 0 && rawTitle.length <= 28;
      const body = hasTitle ? rest.join(":").trim() : content;
      return {
        index: index + 1,
        title: hasTitle ? rawTitle.trim() : `Slide ${index + 1}`,
        content: body,
        expectedMessage: body.length > 80 ? `${body.slice(0, 80)}...` : body
      };
    });
}

function splitScriptForSlides(script: string, count: number) {
  const sentences = script.split(/(?<=[.!?。？！])\s+|\n+/).map((item) => item.trim()).filter(Boolean);
  const perSlide = Math.max(1, Math.ceil(sentences.length / Math.max(count, 1)));
  return Array.from({ length: count }, (_, index) => sentences.slice(index * perSlide, (index + 1) * perSlide).join(" "));
}

function emptySlideTranscripts(slides: PresentationSlide[]): SlideTranscript[] {
  return slides.map((slide) => ({ slideIndex: slide.index, slideTitle: slide.title, transcript: "" }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringItems(value: unknown, limit = 5) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, limit) : [];
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readPrepApiError(value: unknown) {
  if (!isRecord(value)) return "AI 발표 준비 API 요청에 실패했습니다.";
  const errorPayload = value as PrepApiErrorResponse;
  const message = errorPayload.error || errorPayload.message || "AI 발표 준비 API 요청에 실패했습니다.";
  const detail = errorPayload.providerDetails?.message;
  const model = errorPayload.providerDetails?.model;
  const status = errorPayload.providerDetails?.status;
  if (!detail) return message;
  const compactDetail = detail.split("\n").slice(0, 3).join("\n");
  return `${message}\n\nGemini ${model ?? ""}${status ? ` (${status})` : ""}: ${compactDetail}`.trim();
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export function Recorder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "live" ? "live" : "prep";

  const [title, setTitle] = useState("Commudent Sprint 4 발표");
  const [slides, setSlides] = useState("");
  const [script, setScript] = useState("");
  const [timeLimit, setTimeLimit] = useState(5);
  const [formalityLevel, setFormalityLevel] = useState(72);
  const [materialFileName, setMaterialFileName] = useState("");
  const [scriptFileName, setScriptFileName] = useState("");
  const [materialFilePayload, setMaterialFilePayload] = useState<UploadedPrepFile | null>(null);
  const [scriptFilePayload, setScriptFilePayload] = useState<UploadedPrepFile | null>(null);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const [prepStage, setPrepStage] = useState<PrepStage>(mode === "live" ? "practice" : "input");
  const [prepAnalysis, setPrepAnalysis] = useState<RichPresentationPrepAnalysis | null>(null);
  const [prepError, setPrepError] = useState("");
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showScript, setShowScript] = useState(true);
  const [slideTranscripts, setSlideTranscripts] = useState<SlideTranscript[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingFeedback, setPendingFeedback] = useState(false);
  const [statusMessage, setStatusMessage] = useState("발표 자료와 대본을 입력한 뒤 발표 준비하기를 실행하세요.");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const contextType: ContextType = formalityLevel >= 50 ? "formal" : "informal";
  const survey = useMemo<PreSpeechSurveyInput>(() => ({ nervousnessScore: 3, preparednessScore: 4, confidenceScore: 3, conditionScore: 4 }), []);
  const selfCheck = useMemo<PostSpeechSelfCheckInput>(() => ({ contextType, nervousnessScore: 3, perceivedDifficulty: "특별한 어려움은 없었다", userNote: "" }), [contextType]);

  const preparedSlides = prepAnalysis?.slides ?? [];
  const currentSlide = preparedSlides[currentSlideIndex];
  const scriptSegments = useMemo(() => splitScriptForSlides(script, Math.max(preparedSlides.length, 1)), [preparedSlides.length, script]);
  const currentTranscript = currentSlide ? slideTranscripts.find((item) => item.slideIndex === currentSlide.index)?.transcript ?? "" : "";
  const isLastSlide = preparedSlides.length > 0 && currentSlideIndex === preparedSlides.length - 1;
  const canUseMediaRecorder = useMemo(() => typeof window !== "undefined" && "MediaRecorder" in window && navigator.mediaDevices, []);
  const isPrepAnalyzing = prepStage === "analyzing";
  const hasPrepInput = Boolean(slides.trim() || script.trim() || materialFilePayload || scriptFilePayload);
  const canPrepare = hasPrepInput && !isPrepAnalyzing && !isExtractingFile;

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(() => setDurationSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  function resetPrep() {
    setPrepStage("input");
    setPrepAnalysis(null);
    setPrepError("");
    setCurrentSlideIndex(0);
    setSlideTranscripts([]);
    setAudioBlob(null);
    setAudioUrl(null);
    setDurationSeconds(0);
  }

  function setFilePayload(target: "slides" | "script", payload: UploadedPrepFile | null) {
    if (target === "slides") setMaterialFilePayload(payload);
    else setScriptFilePayload(payload);
  }

  function setSelectedFile(target: "slides" | "script", file: File | null) {
    if (target === "slides") setMaterialFile(file);
    else setScriptFile(file);
  }

  async function readUpload(file: File, target: "slides" | "script") {
    if (target === "slides") setMaterialFileName(file.name);
    else setScriptFileName(file.name);
    if (target === "slides") setSlides("");
    else setScript("");
    setSelectedFile(target, file);
    setFilePayload(target, null);
    resetPrep();
    setIsExtractingFile(true);
    const isText = file.type.startsWith("text/") || /\.(txt|md|csv)$/i.test(file.name);
    try {
      if (isText) {
        const text = await file.text();
        if (target === "slides") setSlides(text.trim());
        else setScript(text.trim());
        setStatusMessage(`${file.name} 내용을 불러왔습니다. 발표 준비하기를 실행하세요.`);
        return;
      }

      setStatusMessage(`${file.name} 파일에서 발표 내용을 추출하고 있습니다.`);
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetchWithTimeout("/api/extract-presentation-file", { method: "POST", body: formData }, fileExtractionTimeoutMs);
      const result = (await response.json()) as FileExtractionResponse;
      const extracted = result.text?.trim();
      if (extracted) {
        if (target === "slides") setSlides(extracted);
        else setScript(extracted);
        setStatusMessage(`${file.name}에서 텍스트를 추출했습니다. 발표 준비하기를 실행하면 이 내용이 분석됩니다.`);
      } else {
        setStatusMessage(`${file.name} 텍스트 추출은 비어 있지만, Gemini 분석 요청에 파일 원본을 함께 전달합니다.`);
      }
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError"
        ? "파일 텍스트 추출 시간이 오래 걸려 중단했습니다. 핵심 슬라이드 내용과 대본을 텍스트로 붙여넣어 주세요."
        : error instanceof Error
          ? error.message
          : "파일 텍스트 추출 중 오류가 발생했습니다.";
      setStatusMessage(message);
      setPrepError(message);
    } finally {
      setIsExtractingFile(false);
    }
  }

  async function preparePresentation() {
    if (prepStage === "analyzing") return;
    if (isExtractingFile) {
      setPrepError("파일 내용을 추출하는 중입니다. 추출이 끝난 뒤 발표 준비하기를 눌러 주세요.");
      return;
    }
    if (!hasPrepInput) {
      setPrepError("Gemini 분석을 위해 발표 자료, 발표 대본, 또는 분석 가능한 파일 중 하나가 필요합니다.");
      setStatusMessage("입력된 발표 자료/대본/파일이 없어 AI 분석을 시작하지 않았습니다.");
      return;
    }
    setPrepStage("analyzing");
    setPrepAnalysis(null);
    setPrepError("");
    setStatusMessage("AI가 발표 자료와 대본을 분석하고 있습니다.");
    try {
      const priorReports = await listRecentReports().catch(() => []);
      const formData = new FormData();
      formData.append("title", title);
      formData.append("slides", slides);
      formData.append("script", script);
      formData.append("timeLimit", String(timeLimit));
      formData.append("formalityLevel", String(formalityLevel));
      formData.append("priorReports", JSON.stringify(priorReports.slice(0, 3).map((report) => ({
        nextFocus: report.nextFocus,
        savedInsights: report.savedInsights,
        slideDeliveryFeedback: report.slideDeliveryFeedback,
        messageResults: report.messageResults
      }))));
      if (materialFile) formData.append("slidesFile", materialFile);
      if (scriptFile) formData.append("scriptFile", scriptFile);
      [materialFilePayload, scriptFilePayload].filter(Boolean).forEach((file) => {
        formData.append("files", JSON.stringify(file));
      });

      const response = await fetchWithTimeout("/api/presentation-prep", {
        method: "POST",
        body: formData
      }, prepRequestTimeoutMs);
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(readPrepApiError(payload));

      const analysis = parsePrepAnalysis(payload);
      const normalized = normalizePrepAnalysis(analysis);
      setPrepAnalysis(normalized);
      setSlideTranscripts(emptySlideTranscripts(normalized.slides));
      setPrepStage("ready");
      setStatusMessage("AI 발표 준비 분석이 완료되었습니다. 발표 연습 시작 버튼을 눌러 연습 화면으로 이동하세요.");
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError"
        ? "Gemini 분석 응답이 45초 안에 돌아오지 않아 중단했습니다. 자료/대본을 조금 줄이거나 다시 시도해 주세요."
        : error instanceof Error
          ? error.message
          : "AI 발표 준비 분석 중 오류가 발생했습니다.";
      setPrepAnalysis(null);
      setSlideTranscripts([]);
      setPrepStage("input");
      setPrepError(message);
      setStatusMessage(message);
    }
  }

  function parsePrepAnalysis(value: unknown): RichPresentationPrepAnalysis {
    if (!isRecord(value)) throw new Error("AI 응답을 읽을 수 없습니다. 잠시 후 다시 시도해 주세요.");
    const slideValues = Array.isArray(value.slides) ? value.slides : [];
    const parsedSlides = slideValues
      .map((slide, index): PresentationSlide | null => {
        if (!isRecord(slide)) return null;
        const title = optionalString(slide.title);
        const content = optionalString(slide.content);
        const expectedMessage = optionalString(slide.expectedMessage);
        if (!title || (!content && !expectedMessage)) return null;
        return {
          index: typeof slide.index === "number" ? slide.index : index + 1,
          title,
          content: content ?? expectedMessage ?? "",
          expectedMessage: expectedMessage ?? content ?? "",
          emphasisPoints: stringItems(slide.emphasisPoints, 3)
        };
      })
      .filter((slide): slide is PresentationSlide => Boolean(slide));
    const analysis: RichPresentationPrepAnalysis = {
      keyMessages: stringItems(value.keyMessages, 3),
      emphasisPoints: stringItems(value.emphasisPoints),
      cautions: stringItems(value.cautions),
      overallDeliveryGoal: optionalString(value.overallDeliveryGoal) ?? "",
      slides: parsedSlides,
      audienceQuestions: stringItems(value.audienceQuestions),
      rehearsalChecklist: stringItems(value.rehearsalChecklist),
      timingPlan: stringItems(value.timingPlan),
      openingLine: optionalString(value.openingLine),
      closingLine: optionalString(value.closingLine)
    };

    if (!analysis.keyMessages.length || !analysis.overallDeliveryGoal || !analysis.slides.length) {
      throw new Error("AI 응답 형식이 올바르지 않습니다. 핵심 메시지와 슬라이드 분석을 다시 생성해 주세요.");
    }
    return analysis;
  }

  function normalizePrepAnalysis(analysis: RichPresentationPrepAnalysis): RichPresentationPrepAnalysis {
    const keyMessages = analysis.keyMessages.slice(0, 3);
    const fallbackSlides = splitSlides(slides);
    const normalizedSlides = analysis.slides.length ? analysis.slides : fallbackSlides;
    return {
      ...analysis,
      keyMessages,
      emphasisPoints: analysis.emphasisPoints,
      cautions: analysis.cautions,
      overallDeliveryGoal: analysis.overallDeliveryGoal,
      slides: normalizedSlides.map((slide, index) => ({
        index: Number(slide.index || index + 1),
        title: slide.title || `Slide ${index + 1}`,
        content: slide.content || slide.expectedMessage || "",
        expectedMessage: slide.expectedMessage || keyMessages[index % keyMessages.length] || keyMessages[0],
        emphasisPoints: slide.emphasisPoints?.filter(Boolean)
      })),
      audienceQuestions: analysis.audienceQuestions?.filter(Boolean),
      rehearsalChecklist: analysis.rehearsalChecklist?.filter(Boolean),
      timingPlan: analysis.timingPlan?.filter(Boolean),
      openingLine: analysis.openingLine,
      closingLine: analysis.closingLine
    };
  }

  function startPractice() {
    if (!prepAnalysis) return;
    setPrepStage("practice");
    setCurrentSlideIndex(0);
    setSlideTranscripts(emptySlideTranscripts(prepAnalysis.slides));
    setAudioBlob(null);
    setAudioUrl(null);
    setDurationSeconds(0);
    setStatusMessage("연습 화면에 진입했습니다. 녹음을 시작하고 슬라이드별로 이동하며 발표하세요.");
  }

  async function startRecording() {
    setAudioUrl(null);
    setAudioBlob(null);
    setStatusMessage("마이크 입력을 녹음하고 있습니다.");
    setDurationSeconds(0);
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
          stream.getTracks().forEach((track) => track.stop());
          setStatusMessage("녹음 파일이 준비되었습니다. 연습 종료 후 피드백을 받을 수 있습니다.");
        };
        recorder.start();
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "마이크 권한을 확인해 주세요.");
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
  }

  function updateSlideTranscript(slide: PresentationSlide, transcript: string) {
    setSlideTranscripts((items) => items.map((item) => item.slideIndex === slide.index ? { ...item, transcript } : item));
  }

  function moveSlide(nextIndex: number) {
    if (currentSlide && !currentTranscript) updateSlideTranscript(currentSlide, scriptSegments[currentSlideIndex] || "");
    setCurrentSlideIndex(Math.max(0, Math.min(preparedSlides.length - 1, nextIndex)));
  }

  function restartPractice() {
    stopRecording();
    setPrepStage("practice");
    setCurrentSlideIndex(0);
    setSlideTranscripts(emptySlideTranscripts(preparedSlides));
    setAudioBlob(null);
    setAudioUrl(null);
    setDurationSeconds(0);
    setPendingFeedback(false);
    setStatusMessage("녹음과 슬라이드별 발화 기록을 초기화했습니다.");
  }

  function finishPractice() {
    if (currentSlide && !currentTranscript) updateSlideTranscript(currentSlide, scriptSegments[currentSlideIndex] || "");
    setPrepStage("finished");
    if (isRecording) {
      setPendingFeedback(true);
      stopRecording();
      return;
    }
    if (audioBlob) void analyzePractice();
  }

  const analyzePractice = useCallback(async () => {
    setIsAnalyzing(true);
    setStatusMessage("오디오 저장, STT, 핵심 메시지 전달도 분석을 순서대로 실행하고 있습니다.");
    try {
      const report = await createSpeechReport({
        title,
        contextType,
        script,
        slides,
        timeLimit,
        extractedKeyMessages: prepAnalysis?.keyMessages ?? extractKeyMessages(script, slides),
        emphasisPoints: prepAnalysis?.emphasisPoints,
        prepCautions: prepAnalysis?.cautions,
        slideTranscripts,
        formalityLevel,
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
  }, [audioBlob, audioUrl, contextType, durationSeconds, formalityLevel, prepAnalysis?.cautions, prepAnalysis?.emphasisPoints, prepAnalysis?.keyMessages, router, script, selfCheck, slideTranscripts, slides, survey, timeLimit, title]);

  useEffect(() => {
    if (!pendingFeedback || !audioBlob) return;
    setPendingFeedback(false);
    void analyzePractice();
  }, [audioBlob, pendingFeedback, analyzePractice]);

  if (mode === "live") {
    return (
      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-ink">실제 발표 녹음하기</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">실제 발표 중 녹음을 저장하고, 발표 종료 후 핵심 메시지 전달도와 다음 발표 초점을 남깁니다.</p>
        <RecordingControls
          durationSeconds={durationSeconds}
          isRecording={isRecording}
          isAnalyzing={isAnalyzing}
          audioUrl={audioUrl}
          canAnalyze={Boolean(audioBlob)}
          statusMessage={statusMessage}
          onStart={startRecording}
          onStop={stopRecording}
          onAnalyze={() => void analyzePractice()}
        />
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-marine">Before presentation</p>
            <h2 className="mt-2 text-xl font-black text-ink">발표 준비하기</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">발표 자료와 대본을 입력하면 AI가 핵심 메시지, 강조 포인트, 발표 유의점을 먼저 정리합니다.</p>
          </div>
          <button
            type="button"
            onClick={() => void preparePresentation()}
            disabled={!canPrepare}
            aria-busy={isPrepAnalyzing}
            className="relative h-11 overflow-hidden rounded-lg bg-ink px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-80"
          >
            {isPrepAnalyzing ? (
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal-300" />
                AI 분석 중
              </span>
            ) : isExtractingFile ? "파일 추출 중" : "발표 준비하기"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-700">
              발표 제목
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-marine" />
            </label>
            <label className="block rounded-lg border border-dashed border-teal-200 bg-teal-50 p-4 text-sm font-bold text-slate-700">
              발표 자료 파일
              <input
                type="file"
                accept=".txt,.md,.csv,.pdf,.ppt,.pptx"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readUpload(file, "slides");
                }}
                className="mt-3 block w-full text-sm font-semibold text-slate-600 file:mr-4 file:h-10 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:text-sm file:font-black file:text-white"
              />
              <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{materialFileName ? `${materialFileName} 선택됨` : "PDF / PPT / 텍스트 파일을 등록할 수 있습니다. 텍스트 파일은 내용을 바로 불러옵니다."}</p>
            </label>
            <label className="block text-sm font-bold text-slate-700">
              발표 자료 텍스트
              <textarea value={slides} onChange={(event) => { setSlides(event.target.value); setMaterialFile(null); setMaterialFileName(""); setFilePayload("slides", null); resetPrep(); }} rows={7} placeholder="슬라이드 제목과 주요 내용을 붙여넣거나 파일만 업로드해도 됩니다." className="mt-2 w-full rounded-lg border border-line p-3 text-sm leading-6 outline-none focus:border-marine" />
            </label>
          </div>
          <div className="space-y-4">
            <label className="block rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700">
              발표 대본 파일
              <input
                type="file"
                accept=".txt,.md,.csv,.pdf,.doc,.docx"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readUpload(file, "script");
                }}
                className="mt-3 block w-full text-sm font-semibold text-slate-600 file:mr-4 file:h-10 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:text-sm file:font-black file:text-white"
              />
              <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{scriptFileName ? `${scriptFileName} 선택됨` : "대본 파일 또는 아래 텍스트 입력 중 하나를 사용하세요."}</p>
            </label>
            <div className="grid gap-3 sm:grid-cols-[0.7fr_1.3fr]">
              <label className="block text-sm font-bold text-slate-700">
                제한 시간
                <input type="number" min={1} value={timeLimit} onChange={(event) => setTimeLimit(Number(event.target.value))} className="mt-2 h-11 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-marine" />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                발표 상황: {formalityLevel < 50 ? "Informal" : "Formal"}
                <input type="range" min={0} max={100} value={formalityLevel} onChange={(event) => setFormalityLevel(Number(event.target.value))} className="mt-4 w-full accent-teal-600" />
                <span className="mt-2 flex justify-between text-xs font-black text-slate-400"><span>Informal</span><span>Formal</span></span>
              </label>
            </div>
            <label className="block text-sm font-bold text-slate-700">
              발표 대본
              <textarea value={script} onChange={(event) => { setScript(event.target.value); setScriptFile(null); setScriptFileName(""); setFilePayload("script", null); resetPrep(); }} rows={9} placeholder="발표 대본을 붙여넣거나 파일만 업로드해도 됩니다." className="mt-2 w-full rounded-lg border border-line p-3 text-sm leading-6 outline-none focus:border-marine" />
            </label>
          </div>
        </div>
      </section>

      {prepStage === "input" || isPrepAnalyzing ? (
        <section className={`rounded-lg border p-5 ${isPrepAnalyzing ? "border-teal-100 bg-teal-50" : "border-amber-100 bg-amber-50"}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-sm font-black ${isPrepAnalyzing ? "text-teal-900" : "text-amber-900"}`}>{isPrepAnalyzing ? "AI가 발표 자료를 분석하고 있습니다." : isExtractingFile ? "파일에서 텍스트를 추출하고 있습니다." : "아직 연습 전 단계입니다."}</p>
            {isPrepAnalyzing ? <span className="text-xs font-black uppercase tracking-normal text-teal-700">Gemini/API response required</span> : null}
          </div>
          <p className={`mt-2 text-sm font-semibold leading-6 ${isPrepAnalyzing ? "text-teal-800" : "text-amber-800"}`}>
            {hasPrepInput
              ? "입력 또는 파일이 준비되었습니다. 발표 준비하기를 누르면 Gemini가 가능한 자료를 읽고 슬라이드별/전체 핵심 내용을 분석합니다."
              : "발표 자료 텍스트, 발표 대본, 또는 PDF/텍스트 파일 중 하나를 입력해 주세요."}
          </p>
          {isPrepAnalyzing || isExtractingFile ? (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-teal-500" />
            </div>
          ) : null}
        </section>
      ) : null}

      {prepError ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 p-5">
          <p className="text-sm font-black text-rose-900">AI 발표 준비 분석에 실패했습니다.</p>
          <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-rose-800">{prepError}</p>
          <p className="mt-3 text-xs font-bold leading-5 text-rose-700">API 또는 Gemini 오류가 해결된 뒤 다시 `발표 준비하기`를 눌러 주세요. 유효한 AI 응답이 올 때만 분석 결과가 표시됩니다.</p>
        </section>
      ) : null}

      {prepAnalysis && prepStage === "ready" ? (
        <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-normal text-marine">AI presentation prep</p>
              <h2 className="mt-2 text-xl font-black text-ink">AI 발표 준비 분석</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{prepAnalysis.overallDeliveryGoal}</p>
            </div>
            <button type="button" onClick={startPractice} className="h-11 rounded-lg bg-teal-500 px-5 text-sm font-black text-white">발표 연습 시작</button>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <PrepList title="발표 핵심 메시지 3개" items={prepAnalysis.keyMessages} />
            <PrepList title="발표에서 강조할 포인트" items={prepAnalysis.emphasisPoints} />
            <PrepList title="발표 유의점" items={prepAnalysis.cautions} />
          </div>
          <SlidePrepList slides={prepAnalysis.slides} />
          <RichPrepAnalysis analysis={prepAnalysis} />
        </section>
      ) : null}

      {(prepStage === "practice" || prepStage === "finished") && currentSlide ? (
        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-normal text-marine">Practice</p>
              <h2 className="mt-1 text-xl font-black text-ink">현재 슬라이드 {currentSlideIndex + 1} / {preparedSlides.length}</h2>
            </div>
            <span className="rounded-lg bg-slate-50 px-4 py-2 text-sm font-black text-slate-500">{formatSeconds(durationSeconds)}</span>
          </div>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-h-[420px] bg-slate-50 p-5">
              <div className="flex min-h-[360px] flex-col rounded-lg border border-slate-200 bg-white p-8">
                <p className="text-xs font-black uppercase tracking-normal text-marine">Slide {currentSlide.index}</p>
                <h3 className="mt-3 text-3xl font-black text-ink">{currentSlide.title}</h3>
                <p className="mt-6 text-lg font-semibold leading-8 text-slate-600">{currentSlide.content}</p>
                <div className="mt-auto rounded-lg border border-teal-100 bg-teal-50 p-4">
                  <p className="text-xs font-black text-marine">이 슬라이드 핵심 메시지</p>
                  <p className="mt-2 text-sm font-black leading-6 text-ink">{currentSlide.expectedMessage}</p>
                  {currentSlide.emphasisPoints?.length ? (
                    <ul className="mt-3 space-y-1">
                      {currentSlide.emphasisPoints.map((point, index) => (
                        <li key={`${point}-${index}`} className="text-xs font-bold leading-5 text-slate-600">강조 {index + 1}. {point}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => moveSlide(currentSlideIndex - 1)} disabled={currentSlideIndex === 0} className="h-10 rounded-lg border border-line bg-white px-4 text-sm font-black text-slate-600 disabled:opacity-40">이전 슬라이드</button>
                {!isLastSlide ? (
                  <button type="button" onClick={() => moveSlide(currentSlideIndex + 1)} className="h-10 rounded-lg bg-ink px-4 text-sm font-black text-white">다음 슬라이드</button>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={restartPractice} className="h-10 rounded-lg border border-line bg-white px-4 text-sm font-black text-slate-600">다시 연습하기</button>
                    <button type="button" onClick={finishPractice} disabled={isAnalyzing || (!isRecording && !audioBlob)} className="h-10 rounded-lg bg-teal-500 px-4 text-sm font-black text-white disabled:bg-slate-400">
                      {isAnalyzing ? "분석 중" : "연습 종료 및 피드백 받기"}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <aside className="border-t border-line p-5 lg:border-l lg:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-black text-ink">발표 대본</h3>
                <button type="button" onClick={() => setShowScript((value) => !value)} className="h-8 rounded-lg border border-line bg-slate-50 px-3 text-xs font-black text-slate-500">{showScript ? "숨기기" : "보기"}</button>
              </div>
              {showScript ? <p className="mt-4 max-h-64 overflow-auto whitespace-pre-line text-sm font-semibold leading-7 text-slate-600">{scriptSegments[currentSlideIndex] || script}</p> : null}
              <label className="mt-5 block text-sm font-black text-slate-700">
                Slide {currentSlide.index} transcript
                <textarea value={currentTranscript} onChange={(event) => updateSlideTranscript(currentSlide, event.target.value)} placeholder="연습 중 STT가 저장될 영역입니다. 브라우저 실시간 STT가 없는 환경에서는 슬라이드별 메모/발화 기록을 남길 수 있습니다." rows={6} className="mt-2 w-full rounded-lg border border-line p-3 text-sm leading-6 outline-none focus:border-marine" />
              </label>
              <RecordingControls
                durationSeconds={durationSeconds}
                isRecording={isRecording}
                isAnalyzing={isAnalyzing}
                audioUrl={audioUrl}
                canAnalyze={Boolean(audioBlob)}
                statusMessage={statusMessage}
                onStart={startRecording}
                onStop={stopRecording}
                onAnalyze={() => void analyzePractice()}
                hideAnalyze
              />
            </aside>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PrepList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-black text-ink">{title}</h3>
      <ol className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="text-sm font-semibold leading-6 text-slate-600">{index + 1}. {item}</li>
        ))}
      </ol>
    </div>
  );
}

function SlidePrepList({ slides }: { slides: PresentationSlide[] }) {
  if (!slides.length) return null;

  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-black text-ink">슬라이드별 강조 지점</h3>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {slides.map((slide) => (
          <article key={`${slide.index}-${slide.title}`} className="rounded-lg border border-line bg-white p-4">
            <p className="text-xs font-black text-marine">Slide {slide.index}</p>
            <h4 className="mt-1 text-sm font-black leading-6 text-ink">{slide.title}</h4>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{slide.expectedMessage}</p>
            {slide.emphasisPoints?.length ? (
              <ul className="mt-3 space-y-1">
                {slide.emphasisPoints.map((point, index) => (
                  <li key={`${point}-${index}`} className="text-xs font-bold leading-5 text-slate-500">강조 {index + 1}. {point}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function RichPrepAnalysis({ analysis }: { analysis: RichPresentationPrepAnalysis }) {
  const hasOpeningClosing = Boolean(analysis.openingLine || analysis.closingLine);
  const hasRichLists = Boolean(analysis.rehearsalChecklist?.length || analysis.timingPlan?.length || analysis.audienceQuestions?.length);
  if (!hasOpeningClosing && !hasRichLists) return null;

  return (
    <div className="mt-5 space-y-4">
      {hasOpeningClosing ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {analysis.openingLine ? (
            <div className="rounded-lg border border-teal-100 bg-teal-50 p-4">
              <h3 className="text-sm font-black text-ink">추천 오프닝</h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{analysis.openingLine}</p>
            </div>
          ) : null}
          {analysis.closingLine ? (
            <div className="rounded-lg border border-teal-100 bg-teal-50 p-4">
              <h3 className="text-sm font-black text-ink">추천 클로징</h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{analysis.closingLine}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {hasRichLists ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <PrepList title="연습 체크리스트" items={analysis.rehearsalChecklist ?? []} />
          <PrepList title="시간 배분 가이드" items={analysis.timingPlan ?? []} />
          <PrepList title="예상 질문" items={analysis.audienceQuestions ?? []} />
        </div>
      ) : null}
    </div>
  );
}

function RecordingControls({
  durationSeconds,
  isRecording,
  isAnalyzing,
  audioUrl,
  canAnalyze,
  statusMessage,
  onStart,
  onStop,
  onAnalyze,
  hideAnalyze = false
}: {
  durationSeconds: number;
  isRecording: boolean;
  isAnalyzing: boolean;
  audioUrl: string | null;
  canAnalyze: boolean;
  statusMessage: string;
  onStart: () => void;
  onStop: () => void;
  onAnalyze: () => void;
  hideAnalyze?: boolean;
}) {
  return (
    <div className="mt-5 rounded-lg bg-slate-950 p-5 text-white">
      <div className="text-sm font-bold text-slate-300">녹음 시간</div>
      <div className="mt-2 text-5xl font-black tracking-normal">{formatSeconds(durationSeconds)}</div>
      <div className="mt-5 flex flex-wrap gap-3">
        {!isRecording ? (
          <button type="button" onClick={onStart} className="h-11 rounded-lg bg-white px-5 text-sm font-black text-slate-950">녹음 시작</button>
        ) : (
          <button type="button" onClick={onStop} className="h-11 rounded-lg bg-rose-500 px-5 text-sm font-black text-white">녹음 종료</button>
        )}
        {!hideAnalyze ? (
          <button type="button" onClick={onAnalyze} disabled={isRecording || isAnalyzing || !canAnalyze} className="h-11 rounded-lg bg-teal-500 px-5 text-sm font-black text-white disabled:bg-slate-500">
            {isAnalyzing ? "분석 중" : "피드백 받기"}
          </button>
        ) : null}
      </div>
      {audioUrl ? <audio controls src={audioUrl} className="mt-5 w-full" /> : null}
      <p className="mt-4 text-xs font-semibold text-slate-400">{statusMessage}</p>
    </div>
  );
}
