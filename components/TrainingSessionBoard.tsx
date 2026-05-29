"use client";

import { useMemo, useState } from "react";
import { causeDefinitions } from "@/services/causeInferenceService";
import { getUserProfile } from "@/services/profileService";
import { saveTrainingSession } from "@/services/trainingService";
import type { CauseType, TrainingType } from "@/types/speech";

type TrainingConfig = {
  type: TrainingType;
  targetCause: CauseType;
  title: string;
  prompt: string;
  flow: string[];
  successRule: string;
};

const trainings: TrainingConfig[] = [
  {
    type: "pause_replacement",
    targetCause: "habitual_pattern",
    title: "Pause Replacement Training",
    prompt: "이 서비스가 왜 필요한지 20초 안에 설명해보세요.",
    flow: ["자주 쓰는 filler 확인", "짧은 문장 프롬프트 읽기", "filler가 나오면 다시 시도", "filler 대신 1초 침묵이면 성공"],
    successRule: "음/어/약간/그니까 없이 답변하면 성공"
  },
  {
    type: "structure_training",
    targetCause: "discourse_structure",
    title: "PREP Structure Training",
    prompt: "AI 말습관 코치가 필요한 이유를 PREP 순서로 답하세요.",
    flow: ["Point 작성", "Reason 작성", "Example 작성", "Point로 다시 마무리", "누락된 구조 표시"],
    successRule: "PREP 네 요소가 모두 보이면 성공"
  },
  {
    type: "slow_speech",
    targetCause: "delivery_regulation",
    title: "Slow Speech Training",
    prompt: "30초 동안 천천히 설명하고 목표 WPM에 맞춰보세요.",
    flow: ["목표 WPM 설정", "30초 말하기", "실제 WPM 계산", "빠른 구간 표시", "다음 라운드에서 속도 낮추기"],
    successRule: "목표 WPM과 15 이내 차이면 성공"
  },
  {
    type: "anxiety_training",
    targetCause: "anxiety_pressure",
    title: "Anxiety Start Routine",
    prompt: "첫 문장을 천천히 세 번 반복한 뒤 20초 발표를 시작하세요.",
    flow: ["30초 호흡", "첫 문장 3회 반복", "20초 발표 시작 연습", "초반 filler 변화 확인"],
    successRule: "첫 문장 입력과 안정감 점수 선택 시 완료"
  },
  {
    type: "script_delivery",
    targetCause: "cognitive_load",
    title: "Script Delivery Training",
    prompt: "대본을 넣고 pause mark와 강조 문장을 확인하세요.",
    flow: ["대본 입력", "강조 문장 표시", "pause 위치 삽입", "예상 발표 시간 계산", "실제 녹음과 비교"],
    successRule: "대본과 빠뜨린 내용 메모를 입력하면 완료"
  }
];

export function TrainingSessionBoard() {
  const [activeType, setActiveType] = useState<TrainingType>("pause_replacement");
  const [answer, setAnswer] = useState("");
  const [targetWpm, setTargetWpm] = useState(115);
  const [result, setResult] = useState<string | null>(null);
  const active = trainings.find((training) => training.type === activeType) ?? trainings[0];
  const profile = useMemo(() => (typeof window === "undefined" ? null : getUserProfile()), []);

  async function completeTraining() {
    const hasFiller = /음|어|약간|그니까|뭔가|사실|이제/.test(answer);
    const estimatedWpm = Math.max(70, Math.min(165, Math.round(answer.length * 1.8)));
    const success =
      active.type === "pause_replacement"
        ? !hasFiller && answer.length > 8
        : active.type === "slow_speech"
          ? Math.abs(estimatedWpm - targetWpm) <= 15
          : answer.length > 8;

    await saveTrainingSession({
      trainingType: active.type,
      targetCause: active.targetCause,
      prompt: active.prompt,
      result: {
        success,
        answerLength: answer.length,
        estimatedWpm,
        hasFiller,
        targetWpm
      }
    });
    setResult(success ? "훈련 결과가 저장되었습니다. 이번 라운드는 다음 연습 목표로 넘어가도 좋습니다." : "훈련 결과를 저장했습니다. 같은 프롬프트로 한 번 더 시도해보세요.");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-lg border border-line bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-black text-slate-500">{profile?.nickname ?? "사용자"}님의 훈련</p>
        {trainings.map((training) => (
          <button
            key={training.type}
            type="button"
            onClick={() => {
              setActiveType(training.type);
              setResult(null);
            }}
            className={`mb-2 w-full rounded-lg border px-3 py-3 text-left text-sm font-black ${
              activeType === training.type ? "border-marine bg-teal-50 text-marine" : "border-line text-slate-600 hover:border-slate-300"
            }`}
          >
            {training.title}
          </button>
        ))}
      </aside>

      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-normal text-marine">{causeDefinitions[active.targetCause].label}</p>
        <h1 className="mt-2 text-2xl font-black text-ink">{active.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{causeDefinitions[active.targetCause].description}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {active.flow.map((item, index) => (
            <div key={item} className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs font-black text-slate-400">STEP {index + 1}</p>
              <p className="mt-1 text-sm font-bold text-slate-700">{item}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg bg-slate-50 p-4">
          <p className="text-sm font-black text-ink">연습 프롬프트</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{active.prompt}</p>
        </div>

        {active.type === "slow_speech" ? (
          <label className="mt-5 block text-sm font-bold text-slate-700">
            목표 WPM: {targetWpm}
            <input type="range" min="85" max="145" value={targetWpm} onChange={(event) => setTargetWpm(Number(event.target.value))} className="mt-2 w-full accent-teal-700" />
          </label>
        ) : null}

        <textarea
          value={answer}
          onChange={(event) => {
            setAnswer(event.target.value);
            setResult(null);
          }}
          placeholder="연습 답변을 입력하면 filler, 구조, WPM 추정값으로 결과를 저장합니다."
          className="mt-5 min-h-32 w-full rounded-lg border border-line p-3 text-sm leading-6 outline-none focus:border-marine focus:ring-2 focus:ring-teal-100"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={completeTraining} className="h-11 rounded-lg bg-ink px-5 text-sm font-black text-white">
            결과 저장
          </button>
          <span className="text-xs font-semibold text-slate-500">{active.successRule}</span>
        </div>
        {result ? <div className="mt-4 rounded-lg bg-teal-50 p-4 text-sm font-bold leading-6 text-teal-950">{result}</div> : null}
      </section>
    </div>
  );
}
