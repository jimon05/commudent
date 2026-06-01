"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { createAudioRecorder, mediaRecorderUnavailableMessage } from "@/services/audioRecording";
import { getOnboardingStatus, saveOnboarding, saveProfileSetup, saveVoiceProfileStep } from "@/services/profileService";
import type { MainPainPoint, PrimaryGoal } from "@/types/speech";

const voicePrompt =
  "안녕하세요. 이 샘플은 발표 연습 녹음에서 제 발화를 더 잘 인식하기 위한 기준입니다. Commudent는 발표 자료와 대본의 핵심 내용을 기준으로 전달 여부를 확인합니다.";

const defaultPrimaryGoal: PrimaryGoal = "presentation";
const defaultPainPoints: MainPainPoint[] = ["weak_delivery"];

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState("나의 Commudent profile");
  const [isRecording, setIsRecording] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [voiceSampleUrl, setVoiceSampleUrl] = useState<string | null>(null);
  const [voiceSampleBlob, setVoiceSampleBlob] = useState<Blob | null>(null);
  const [voiceStatus, setVoiceStatus] = useState("선택 사항");
  const [voiceBars, setVoiceBars] = useState<number[]>(Array.from({ length: 24 }, (_, index) => 16 + (index % 6) * 6));
  const [isSaving, setIsSaving] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(() => setDurationSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    return () => stopVoiceVisualizer();
  }, []);

  useEffect(() => {
    let mounted = true;
    getOnboardingStatus().then((status) => {
      if (!mounted) return;
      if (status.onboardingCompleted) {
        router.replace("/");
        return;
      }
      if (status.profile) {
        setNickname(status.profile.nickname);
      }
      if (status.voiceProfile) {
        setVoiceSampleUrl(status.voiceProfile.sampleAudioUrl ?? "mock://voice-sample");
        setVoiceStatus(status.voiceProfile.enrollmentStatus === "sample_saved" ? "샘플 저장됨" : "voice profile 준비됨");
      }
      setStep(resolveOnboardingStep(status));
      setIsHydrating(false);
    }).catch(() => setIsHydrating(false));
    return () => {
      mounted = false;
    };
  }, [router]);

  const totalSteps = 4;
  const progress = Math.round(((step + 1) / totalSteps) * 100);
  const nextDisabled = step === 1 && nickname.trim().length < 2;

  function goNext() {
    setStep((value) => Math.min(totalSteps - 1, value + 1));
  }

  async function handleNext() {
    setIsSaving(true);
    try {
      if (step === 1) await saveProfileSetup({ nickname: nickname.trim() || "나의 Commudent profile" });
      if (step === 2) {
        await saveVoiceProfileStep({
          voiceSampleUrl: voiceSampleUrl ?? "mock://voice-sample",
          voiceSampleBlob,
          voiceDurationSeconds: Math.max(durationSeconds, 20)
        });
      }
      goNext();
    } finally {
      setIsSaving(false);
    }
  }

  function stopVoiceVisualizer() {
    if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
  }

  function startVoiceVisualizer(stream: MediaStream) {
    stopVoiceVisualizer();
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    audioContextRef.current = audioContext;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const sliceSize = Math.max(1, Math.floor(data.length / 24));
      setVoiceBars(Array.from({ length: 24 }, (_, index) => {
        const slice = data.slice(index * sliceSize, index * sliceSize + sliceSize);
        const average = slice.reduce((sum, value) => sum + value, 0) / Math.max(slice.length, 1);
        return Math.max(10, Math.min(96, 12 + average * 0.42));
      }));
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };
    tick();
  }

  async function startVoiceSample() {
    setDurationSeconds(0);
    setVoiceSampleUrl(null);
    setVoiceSampleBlob(null);
    setVoiceStatus("마이크 입력 확인 중");
    chunksRef.current = [];

    if ("MediaRecorder" in window && navigator.mediaDevices) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = createAudioRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          setVoiceSampleBlob(blob);
          setVoiceSampleUrl(URL.createObjectURL(blob));
          stream.getTracks().forEach((track) => track.stop());
          stopVoiceVisualizer();
          setVoiceStatus("샘플 저장됨");
        };
        startVoiceVisualizer(stream);
        recorder.start();
        setIsRecording(true);
        setVoiceStatus("목소리 입력 중");
      } catch {
        setVoiceSampleUrl("mock://voice-sample");
        setVoiceStatus("마이크 권한 없음 · mock 샘플 사용");
        setIsRecording(false);
      }
    } else {
      setVoiceSampleUrl("mock://voice-sample");
      setVoiceStatus(mediaRecorderUnavailableMessage());
    }
  }

  function stopVoiceSample() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    stopVoiceVisualizer();
    setVoiceStatus("샘플 저장 중");
    if (durationSeconds < 20) setDurationSeconds(20);
  }

  async function complete() {
    setIsSaving(true);
    await saveOnboarding({
      nickname: nickname.trim() || "나의 Commudent profile",
      primaryGoal: defaultPrimaryGoal,
      mainPainPoints: defaultPainPoints,
      voiceSampleUrl: voiceSampleUrl ?? "mock://voice-sample",
      voiceSampleBlob,
      voiceDurationSeconds: Math.max(durationSeconds, 20),
      selfCheckAnswers: {
        profile_name: nickname,
        primary_goal: defaultPrimaryGoal,
        selected_pain_points: defaultPainPoints.join(","),
        onboarding_focus: "core_content_delivery"
      }
    });
    router.replace("/");
  }

  if (isHydrating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-sm font-black text-slate-300">
        Commudent onboarding 상태를 확인하는 중입니다.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-normal text-slate-500">
            <span>{String(step + 1).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}</span>
            <span>{stepLabel(step)}</span>
          </div>
          <div className="mt-3 h-1 rounded-full bg-white/10">
            <div className="h-1 rounded-full bg-teal-300 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </header>

        <section className="flex flex-1 items-center py-4">
          {step === 0 ? <WelcomeStep onStart={goNext} /> : null}
          {step === 1 ? (
            <StepShell eyebrow="Setup" title="발표 연습 기록을 시작합니다" subtitle="계정 승인 없이 바로 사용할 수 있습니다. 이름만 정하면 발표 자료, 대본, 녹음, 피드백이 이 브라우저에 저장됩니다.">
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <label className="rounded-lg border border-white/10 bg-white/[0.04] p-5 text-sm font-black text-slate-300">
                  Profile name
                  <input
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    className="mt-3 h-14 w-full rounded-lg border border-white/10 bg-slate-900 px-4 text-lg font-black text-white outline-none focus:border-teal-300"
                  />
                  <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">이 이름으로 리포트와 장기 분석 기록이 저장됩니다.</p>
                </label>
                <div className="space-y-5">
                  <PublicAccessNotice />
                  <SetupNotice />
                </div>
              </div>
            </StepShell>
          ) : null}
          {step === 2 ? (
            <StepShell eyebrow="Voice sample" title="음성 인식 준비" subtitle="선택 단계입니다. 발표 연습 녹음에서 내 발화를 더 안정적으로 인식하는 데 사용합니다.">
              <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
                <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-sm font-semibold leading-7 text-slate-300">{voicePrompt}</p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {!isRecording ? (
                      <button type="button" onClick={startVoiceSample} className="h-11 rounded-lg bg-teal-300 px-5 text-sm font-black text-slate-950">
                        voice sample 녹음
                      </button>
                    ) : (
                      <button type="button" onClick={stopVoiceSample} className="h-11 rounded-lg bg-rose-500 px-5 text-sm font-black text-white">
                        녹음 종료
                      </button>
                    )}
                    <button type="button" onClick={() => { setVoiceSampleUrl("mock://voice-sample"); setVoiceStatus("나중에 설정"); }} className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-5 text-sm font-black text-slate-300">
                      나중에 설정
                    </button>
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-900 p-5">
                  <p className="text-xs font-black uppercase tracking-normal text-teal-200">Voice status</p>
                  <p className="mt-3 text-4xl font-black">{durationSeconds}s</p>
                  <p className="mt-3 text-sm font-semibold text-slate-400">{voiceStatus}</p>
                  <div className="mt-5 flex h-28 items-end gap-1 rounded-lg border border-white/10 bg-slate-950 p-3">
                    {voiceBars.map((height, index) => (
                      <span
                        key={`${index}-${height}`}
                        className={`w-full rounded-sm transition-all duration-75 ${isRecording ? "bg-teal-300" : "bg-slate-700"}`}
                        style={{ height: `${isRecording ? height : Math.max(8, height * 0.35)}%` }}
                      />
                    ))}
                  </div>
                  {voiceSampleUrl?.startsWith("blob:") ? <audio controls src={voiceSampleUrl} className="mt-5 w-full" /> : null}
                </div>
              </div>
            </StepShell>
          ) : null}
          {step === 3 ? (
            <StepShell eyebrow="Ready" title="발표 자료와 대본을 넣고 핵심 내용 전달을 연습하세요" subtitle="Commudent는 슬라이드별 핵심 내용을 먼저 정리하고, 연습 피드백에서 각 슬라이드와 전체 발표가 그 내용을 충분히 전달했는지 확인합니다.">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["자료 입력", "슬라이드와 발표 대본을 함께 등록합니다."],
                  ["핵심 내용 정리", "AI가 슬라이드별로 꼭 전달해야 할 내용을 잡습니다."],
                  ["연습 피드백", "녹음 후 슬라이드별/전체 전달 여부를 확인합니다."]
                ].map(([title, body]) => (
                  <div key={title} className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-sm font-black text-teal-200">{title}</p>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">{body}</p>
                  </div>
                ))}
              </div>
              <button type="button" onClick={complete} disabled={isSaving} className="mt-7 h-12 rounded-lg bg-teal-300 px-6 text-sm font-black text-slate-950 disabled:opacity-60">
                {isSaving ? "연습 공간 저장 중" : "Commudent 시작하기"}
              </button>
            </StepShell>
          ) : null}
        </section>

        {step > 0 ? <footer className="sticky bottom-0 mt-5 py-3">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/90 p-2 backdrop-blur">
            <button
              type="button"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              disabled={step === 0}
              className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-slate-400 disabled:cursor-not-allowed disabled:opacity-35"
            >
              이전
            </button>
            {step < totalSteps - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={nextDisabled || isSaving}
                className="h-11 rounded-lg bg-teal-300 px-5 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              >
                {isSaving ? "저장 중" : "다음"}
              </button>
            ) : null}
          </div>
        </footer> : null}
      </div>
    </div>
  );
}

function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="w-full">
      <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <section>
          <h1 className="max-w-4xl text-5xl font-black leading-tight tracking-normal text-white sm:text-6xl lg:text-7xl">Commudent</h1>
          <p className="mt-5 max-w-2xl text-lg font-black leading-8 text-slate-300 sm:text-xl">
            말과 전달 사이의 차이를 줄여주는 발표 지원 서비스
          </p>
          <button type="button" onClick={onStart} className="mt-8 h-12 rounded-lg bg-teal-300 px-6 text-sm font-black text-slate-950">
            Commudent 시작하기
          </button>
        </section>
        <aside className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-black uppercase tracking-normal text-teal-200">Flow</p>
          <div className="mt-5 space-y-3">
            {[
              ["자료 입력", "발표 자료 파일과 대본을 등록합니다."],
              ["핵심 내용 파악", "AI가 슬라이드별/전체 발표 핵심 내용을 정리합니다."],
              ["연습 녹음", "핵심 내용이 실제로 전달됐는지 기준을 잡고 연습합니다."],
              ["다음 발표 연결", "피드백을 발표 이력으로 저장해 다음 준비에 사용합니다."]
            ].map(([title, body], index) => (
              <div key={title} className="grid grid-cols-[36px_1fr] gap-3 rounded-lg border border-white/10 bg-slate-950/40 p-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-300 text-xs font-black text-slate-950">{index + 1}</span>
                <span>
                  <span className="block text-sm font-black text-white">{title}</span>
                  <span className="mt-1 block text-sm font-semibold leading-6 text-slate-400">{body}</span>
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function StepShell({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="w-full">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-200">{eyebrow}</p>
      <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight tracking-normal text-white sm:text-4xl lg:text-5xl">{title}</h1>
      <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-slate-400">{subtitle}</p>
      <div className="mt-7">{children}</div>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="rounded-lg border border-teal-300/20 bg-teal-300/10 p-5">
      <p className="text-sm font-black text-teal-100">피드백 기준</p>
      <p className="mt-3 text-sm font-semibold leading-7 text-slate-300">
        첫 연습부터 발표 자료와 대본의 핵심 내용 전달 여부를 기준으로 피드백합니다.
      </p>
    </div>
  );
}

function PublicAccessNotice() {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <p className="text-sm font-black text-white">공개 데모 모드</p>
      <p className="mt-3 text-sm font-semibold leading-7 text-slate-300">
        별도 로그인이나 운영자 승인 없이 서비스를 둘러보고 발표 연습을 시작할 수 있습니다. Supabase를 연결한 배포 환경에서는 로그인 사용자의 데이터만 클라우드에 저장되고, 비로그인 사용자는 로컬 저장소를 사용합니다.
      </p>
    </div>
  );
}

function stepLabel(step: number) {
  return ["Intro", "Setup", "Voice", "Start"][step];
}

function resolveOnboardingStep(status: Awaited<ReturnType<typeof getOnboardingStatus>>) {
  if (!status.profile) return 0;
  if (!status.voiceProfile) return 2;
  return 3;
}
