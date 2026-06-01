"use client";

import { useMemo, useState } from "react";
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
    title: "핵심 문장 강조 연습",
    prompt: "첫 슬라이드의 핵심 내용을 20초 안에 한 문장으로 설명해보세요.",
    flow: ["슬라이드 핵심 내용 확인", "핵심 문장 작성", "한 박자 쉬고 읽기", "같은 결론어로 마무리"],
    successRule: "핵심 문장이 처음과 끝에 모두 보이면 성공"
  },
  {
    type: "structure_training",
    targetCause: "discourse_structure",
    title: "슬라이드-결론 연결 연습",
    prompt: "두 번째 슬라이드가 발표 전체 결론에 왜 필요한지 설명해보세요.",
    flow: ["슬라이드 제목 확인", "근거 한 문장 작성", "전체 결론과 연결", "전환 문장으로 마무리"],
    successRule: "슬라이드 내용과 전체 결론이 함께 보이면 성공"
  },
  {
    type: "slow_speech",
    targetCause: "delivery_regulation",
    title: "천천히 전달할 구간 연습",
    prompt: "청중이 꼭 기억해야 할 문장을 천천히 읽는다고 생각하고 작성해보세요.",
    flow: ["핵심 문장 선택", "직전 쉬어가기 표시", "천천히 읽을 문장 작성", "다음 슬라이드 연결"],
    successRule: "핵심 문장 앞뒤에 쉬어가기 표시가 있으면 성공"
  },
  {
    type: "anxiety_training",
    targetCause: "anxiety_pressure",
    title: "도입 핵심 내용 고정",
    prompt: "발표 시작 15초 안에 말할 첫 핵심 문장을 작성해보세요.",
    flow: ["발표 전체 결론 확인", "첫 문장 작성", "청중 기억 단어 표시", "도입에서 한 번 더 반복"],
    successRule: "발표 전체 결론이 첫 문장에 포함되면 성공"
  },
  {
    type: "script_delivery",
    targetCause: "cognitive_load",
    title: "수정 대본 표시 연습",
    prompt: "[강조], [잠깐 쉬기], [결론과 연결] 표시를 넣어 대본 한 단락을 고쳐보세요.",
    flow: ["대본 단락 선택", "강조 표시", "쉬어가기 표시", "결론 연결 표시", "다음 녹음에서 확인"],
    successRule: "세 가지 표시가 모두 들어가면 완료"
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
        ? answer.length > 8
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
        <p className="text-xs font-black uppercase tracking-normal text-marine">Presentation practice</p>
        <h1 className="mt-2 text-2xl font-black text-ink">{active.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">슬라이드별 핵심 내용이 실제 발표에서 빠지지 않도록, 강조와 연결 문장을 짧게 연습합니다.</p>

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
          placeholder="연습 문장을 입력하면 다음 발표 준비 기록으로 저장합니다."
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
