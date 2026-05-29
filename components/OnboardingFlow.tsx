"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { AuthPanel } from "@/components/AuthPanel";
import { createAudioRecorder, mediaRecorderUnavailableMessage } from "@/services/audioRecording";
import { getOnboardingStatus, saveOnboarding, saveOnboardingQuestions, saveProfileSetup, saveVoiceProfileStep } from "@/services/profileService";
import type { CauseScoreAliases, MainPainPoint, PrimaryGoal } from "@/types/speech";

const situationOptions: Array<{ id: PrimaryGoal; title: string; body: string; pain: MainPainPoint }> = [
  { id: "presentation", title: "발표", body: "청중 앞에서 핵심을 안정적으로 전달하고 싶어요.", pain: "blank_mind" },
  { id: "interview", title: "면접", body: "평가 상황에서 답변을 더 분명하게 만들고 싶어요.", pain: "too_long" },
  { id: "meeting", title: "회의", body: "업무 맥락에서 짧고 정확하게 의견을 말하고 싶어요.", pain: "disorganized" },
  { id: "daily", title: "일상 대화", body: "평소 반복 표현과 말습관을 알고 싶어요.", pain: "many_fillers" },
  { id: "class_discussion", title: "수업/토론", body: "토론 중 구조와 전달력을 개선하고 싶어요.", pain: "fast_speech" }
];

const difficultyOptions: Array<{ id: MainPainPoint; title: string; body: string }> = [
  { id: "blank_mind", title: "긴장하면 머리가 하얘진다", body: "초반 발화가 흔들리거나 말문이 늦게 열려요." },
  { id: "disorganized", title: "생각은 있는데 말로 정리가 안 된다", body: "말하는 중에 구조가 뒤늦게 잡혀요." },
  { id: "too_long", title: "말이 길어지고 결론이 늦어진다", body: "핵심 전에 설명이 길어져요." },
  { id: "many_fillers", title: "특정 표현을 반복한다", body: "음/어/약간 또는 같은 표현이 반복돼요." },
  { id: "fast_speech", title: "말이 너무 빠르거나 전달이 잘 안 된다", body: "청자가 따라왔는지 확신하기 어려워요." },
  { id: "weak_delivery", title: "적절한 표현이 잘 떠오르지 않는다", body: "의미는 있는데 단어 선택이 모호해져요." }
];

const goalOptions = ["발표 긴장 완화", "생각 정리", "구조화", "반복 표현 줄이기", "전달력 향상", "어휘/표현력 향상"];
const voicePrompt =
  "안녕하세요. 이 샘플은 이후 대화 녹음에서 제 발화를 중심으로 분석하기 위한 기준입니다. Commudent는 녹음 데이터를 바탕으로 말습관과 전달 패턴을 분석합니다.";

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState("나의 Commudent profile");
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | null>(null);
  const [mainPainPoints, setMainPainPoints] = useState<MainPainPoint[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
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
        setPrimaryGoal(status.profile.primaryGoal);
        setMainPainPoints(status.profile.mainPainPoints);
      }
      if (status.selfCheck?.answers) {
        const restoredAnswers = Object.fromEntries(
          Object.entries(status.selfCheck.answers).map(([key, value]) => [key, String(value)])
        );
        setAnswers(restoredAnswers);
      }
      if (status.voiceProfile) {
        setVoiceSampleUrl(status.voiceProfile.sampleAudioUrl ?? "mock://voice-sample");
        setVoiceStatus(status.voiceProfile.enrollmentStatus === "sample_saved" ? "샘플 저장됨" : "voice profile 준비됨");
      }
      setStep(status.profile || status.selfCheck || status.voiceProfile ? status.nextStep : 0);
      setIsHydrating(false);
    }).catch(() => setIsHydrating(false));
    return () => {
      mounted = false;
    };
  }, [router]);

  const initialScores = useMemo(() => estimateInitialScores(mainPainPoints, answers), [mainPainPoints, answers]);
  const topInitial = Object.entries(initialScores).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const totalSteps = 7;
  const progress = Math.round(((step + 1) / totalSteps) * 100);
  const nextDisabled =
    (step === 1 && nickname.trim().length < 2) ||
    (step === 2 && !primaryGoal) ||
    (step === 3 && mainPainPoints.length === 0) ||
    (step === 4 && !answers.improvement_goal);

  function goNext() {
    setStep((value) => Math.min(totalSteps - 1, value + 1));
  }

  async function handleNext() {
    setIsSaving(true);
    try {
      if (step === 1) await saveProfileSetup({ nickname: nickname.trim() || "나의 Commudent profile" });
      if (step === 4) {
        await saveOnboardingQuestions({
          nickname: nickname.trim() || "나의 Commudent profile",
          primaryGoal: primaryGoal ?? "presentation",
          mainPainPoints: mainPainPoints.length > 0 ? mainPainPoints : ["many_fillers"],
          selfCheckAnswers: {
            ...answers,
            profile_name: nickname,
            primary_goal: primaryGoal ?? "presentation",
            selected_pain_points: mainPainPoints.join(",")
          }
        });
      }
      if (step === 5) {
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

  function chooseSituation(option: (typeof situationOptions)[number]) {
    setPrimaryGoal(option.id);
    setAnswers((current) => ({ ...current, help_context: option.title }));
    setMainPainPoints((current) => unique([...current, option.pain]));
  }

  function togglePainPoint(point: MainPainPoint, label: string) {
    setAnswers((current) => ({ ...current, difficulty: label }));
    setMainPainPoints((current) => (current.includes(point) ? current.filter((item) => item !== point) : unique([...current, point])));
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
      primaryGoal: primaryGoal ?? "presentation",
      mainPainPoints: mainPainPoints.length > 0 ? mainPainPoints : ["many_fillers"],
      voiceSampleUrl: voiceSampleUrl ?? "mock://voice-sample",
      voiceSampleBlob,
      voiceDurationSeconds: Math.max(durationSeconds, 20),
      selfCheckAnswers: {
        ...answers,
        profile_name: nickname,
        primary_goal: primaryGoal ?? "presentation",
        selected_pain_points: mainPainPoints.join(",")
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
            <StepShell eyebrow="Profile setup" title="당신의 communication profile을 설정합니다" subtitle="Commudent는 녹음 데이터를 기반으로 장기적인 전달 패턴 변화를 기록합니다.">
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
                  <Suspense fallback={<div className="rounded-lg border border-white/10 bg-white/[0.04] p-5 text-sm font-bold text-slate-300">로그인 화면을 준비하는 중입니다.</div>}>
                    <AuthPanel
                      compact
                      onAuthSuccess={(status) => {
                        if (status.onboardingCompleted) router.replace("/");
                        else setStep(status.nextStep);
                      }}
                    />
                  </Suspense>
                  <ModelNotice />
                </div>
              </div>
            </StepShell>
          ) : null}
          {step === 2 ? (
            <ChoiceStep
              eyebrow="Context"
              title="어떤 상황에서 가장 도움을 받고 싶나요?"
              subtitle="상황 정보는 첫 분석의 참고값으로만 사용되며, 실제 결과는 녹음 데이터가 우선합니다."
              options={situationOptions}
              active={(option) => primaryGoal === option.id}
              onSelect={chooseSituation}
            />
          ) : null}
          {step === 3 ? (
            <ChoiceStep
              eyebrow="Difficulty"
              title="말할 때 가장 자주 느끼는 어려움은 무엇인가요?"
              subtitle="여러 개를 선택할 수 있습니다. 온보딩만으로 사용자를 단정하지 않습니다."
              options={difficultyOptions}
              active={(option) => mainPainPoints.includes(option.id)}
              onSelect={(option) => togglePainPoint(option.id, option.title)}
            />
          ) : null}
          {step === 4 ? (
            <OptionStep
              eyebrow="Goal"
              title="가장 먼저 개선하고 싶은 목표는 무엇인가요?"
              subtitle="목표는 훈련 추천의 우선순위를 정하는 데 사용됩니다."
              options={goalOptions}
              value={answers.improvement_goal}
              onSelect={(value) => {
                setAnswers((current) => ({ ...current, improvement_goal: value }));
                const point = goalToPainPoint(value);
                if (point) setMainPainPoints((current) => unique([...current, point]));
              }}
            />
          ) : null}
          {step === 5 ? (
            <StepShell eyebrow="Voice profile" title="내 발화 중심 분석을 준비합니다" subtitle="여러 사람 대화 속에서도 이후에는 내 발화 중심으로 분석하기 위한 준비 단계입니다.">
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
          {step === 6 ? (
            <StepShell eyebrow="Ready" title="첫 녹음을 시작하면 Commudent가 당신의 말하기 패턴을 분석합니다" subtitle="녹음 후 self-check, feature extraction, weighted inference, feedback generation이 순서대로 실행됩니다.">
              <div className="grid gap-4 md:grid-cols-2">
                {topInitial.map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-sm font-black text-teal-200">{initialLabel(key)}</p>
                    <p className="mt-2 text-3xl font-black">{Math.round(value * 100)}%</p>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">초기 참고값입니다. 실제 원인 점수는 녹음 분석 결과가 우선합니다.</p>
                  </div>
                ))}
              </div>
              <button type="button" onClick={complete} disabled={isSaving} className="mt-7 h-12 rounded-lg bg-teal-300 px-6 text-sm font-black text-slate-950 disabled:opacity-60">
                {isSaving ? "분석 공간 저장 중" : "Commudent 시작하기"}
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
                {isSaving ? "저장 중" : step === 0 ? "나의 말습관 분석 시작하기" : "다음"}
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
      <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-200">COMMUNICATION ANALYSIS & COACHING</p>
        <h1 className="mt-5 text-4xl font-black leading-tight tracking-normal text-white sm:text-5xl lg:text-6xl">Commudent</h1>
        <p className="mt-4 max-w-2xl text-2xl font-black leading-snug text-slate-100 sm:text-3xl">말과 전달 사이의 차이를, 함께 좁혀갑니다.</p>
      </section>
      <AnalysisPipeline />
      </div>
      <div className="mt-8 flex flex-col items-center text-center">
        <button type="button" onClick={onStart} className="group border-b border-teal-300 pb-2 text-base font-black text-teal-200 transition hover:border-teal-100 hover:text-white">
          Commudent 시작하기 <span className="inline-block transition group-hover:translate-x-1">→</span>
        </button>
        <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-slate-400">
          Commudent는 녹음된 발화를 바탕으로 말습관, 전달 속도, 구조화 방식, 표현 패턴을 분석합니다.
        </p>
      </div>
    </div>
  );
}

function AnalysisPipeline() {
  const steps = [
    ["녹음", "발표, 면접, 회의, 대화 상황을 녹음합니다."],
    ["Self-check", "녹음 직후 상황과 긴장도를 직접 입력합니다."],
    ["Feature extraction", "filler, pause, 말속도, 문장 길이, 구조, 표현 다양성을 추출합니다."],
    ["Weighted inference", "하나의 말습관을 단정하지 않고 여러 feature 조합으로 원인 가능성을 계산합니다."],
    ["Feedback generation", "말습관, 전달력, 표현력 개선 방향과 다음 훈련을 제안합니다."],
    ["Long-term report", "녹음 기반 결과를 누적해 변화 흐름을 기록합니다."]
  ];
  return (
    <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
      <p className="text-xs font-black uppercase tracking-normal text-teal-200">How analysis works</p>
      <h2 className="mt-2 text-2xl font-black text-white">분석은 이렇게 진행됩니다</h2>
      <div className="mt-5 space-y-1">
        {steps.map(([title, body], index) => (
          <div key={title} className="grid grid-cols-[44px_1fr] gap-3 border-l border-white/10 py-3 pl-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-teal-300/40 bg-slate-900 text-xs font-black text-teal-200">{index + 1}</span>
            <span>
              <span className="block text-sm font-black text-white">{title}</span>
              <span className="mt-1 block text-sm font-semibold leading-6 text-slate-400">{body}</span>
            </span>
          </div>
        ))}
      </div>
    </aside>
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

function ChoiceStep<T extends { title: string; body: string }>({
  eyebrow,
  title,
  subtitle,
  options,
  active,
  onSelect
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  options: T[];
  active: (option: T) => boolean;
  onSelect: (option: T) => void;
}) {
  return (
    <StepShell eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {options.map((option) => (
          <SelectCard key={option.title} active={active(option)} title={option.title} body={option.body} onClick={() => onSelect(option)} />
        ))}
      </div>
    </StepShell>
  );
}

function OptionStep({ eyebrow, title, subtitle, options, value, onSelect }: { eyebrow: string; title: string; subtitle: string; options: string[]; value?: string; onSelect: (value: string) => void }) {
  return (
    <StepShell eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {options.map((option) => (
          <button key={option} type="button" onClick={() => onSelect(option)} className={choiceClass(value === option)}>
            {option}
          </button>
        ))}
      </div>
    </StepShell>
  );
}

function SelectCard({ active, title, body, onClick }: { active: boolean; title: string; body: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-32 rounded-lg border p-4 text-left transition ${active ? "border-teal-300/70 bg-teal-300/10" : "border-white/10 bg-white/[0.04] hover:border-white/25"}`}>
      <span className="block text-base font-black text-white">{title}</span>
      <span className="mt-2 block text-sm font-semibold leading-6 text-slate-400">{body}</span>
    </button>
  );
}

function ModelNotice() {
  return (
    <div className="rounded-lg border border-teal-300/20 bg-teal-300/10 p-5">
      <p className="text-sm font-black text-teal-100">분석 모델 연결 방식</p>
      <p className="mt-3 text-sm font-semibold leading-7 text-slate-300">
        이 답변은 첫 분석의 참고값으로만 사용되며, 실제 결과는 녹음 데이터를 바탕으로 계산됩니다. 온보딩 정보는 cause inference에서 최대 0.08 bias로만 반영됩니다.
      </p>
    </div>
  );
}

function choiceClass(active: boolean) {
  return `min-h-16 rounded-lg border px-4 text-left text-sm font-black transition ${
    active ? "border-teal-300/70 bg-teal-300/10 text-white" : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25"
  }`;
}

function stepLabel(step: number) {
  return ["Welcome", "Profile", "Context", "Difficulty", "Goal", "Voice", "Start"][step];
}

function estimateInitialScores(points: MainPainPoint[], answers: Record<string, string>): CauseScoreAliases {
  const answerText = Object.values(answers).join(" ");
  return {
    anxiety: clamp((points.includes("blank_mind") ? 0.46 : 0.16) + (answerText.includes("긴장") || answerText.includes("하얘") ? 0.18 : 0)),
    cognitive_load: clamp((answerText.includes("정리") || answerText.includes("표현") ? 0.44 : 0.16) + (points.includes("blank_mind") ? 0.12 : 0)),
    discourse: clamp((points.includes("disorganized") || points.includes("too_long") ? 0.46 : 0.16) + (answerText.includes("결론") || answerText.includes("두서") ? 0.18 : 0)),
    habitual: clamp((points.includes("many_fillers") ? 0.46 : 0.16) + (answerText.includes("반복") || answerText.includes("음/어") ? 0.18 : 0)),
    delivery: clamp((points.includes("fast_speech") || points.includes("weak_delivery") ? 0.46 : 0.16) + (answerText.includes("빠르") || answerText.includes("전달") ? 0.18 : 0))
  };
}

function initialLabel(key: string) {
  const labels: Record<string, string> = {
    anxiety: "불안/평가압박 참고값",
    cognitive_load: "인지부하 참고값",
    discourse: "구조화 참고값",
    habitual: "자동습관 참고값",
    delivery: "전달조절 참고값"
  };
  return labels[key] ?? key;
}

function goalToPainPoint(goal: string): MainPainPoint | null {
  if (goal.includes("긴장")) return "blank_mind";
  if (goal.includes("정리")) return "disorganized";
  if (goal.includes("구조")) return "too_long";
  if (goal.includes("반복")) return "many_fillers";
  if (goal.includes("전달")) return "fast_speech";
  if (goal.includes("어휘") || goal.includes("표현")) return "weak_delivery";
  return null;
}

function clamp(value: number) {
  return Math.max(0.05, Math.min(0.92, value));
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}
