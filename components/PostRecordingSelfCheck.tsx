"use client";

import { contextLabels } from "@/lib/mockData";
import type { ContextType, PostSpeechSelfCheckInput } from "@/types/speech";

const contexts = Object.entries(contextLabels) as Array<[ContextType, string]>;
const difficulties: PostSpeechSelfCheckInput["perceivedDifficulty"][] = [
  "긴장했다",
  "생각이 정리되지 않았다",
  "말이 빨랐다",
  "단어가 떠오르지 않았다",
  "같은 표현을 반복했다",
  "특별한 어려움은 없었다"
];

export function PostRecordingSelfCheck({
  value,
  onChange,
  onConfirm,
  isOpen
}: {
  value: PostSpeechSelfCheckInput;
  onChange: (value: PostSpeechSelfCheckInput) => void;
  onConfirm: () => void;
  isOpen: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
      <section className="w-full max-w-2xl rounded-lg border border-line bg-white p-5 shadow-soft">
        <p className="text-xs font-black uppercase tracking-normal text-marine">Post recording self-check</p>
        <h2 className="mt-2 text-2xl font-black text-ink">방금 녹음의 맥락을 알려주세요.</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">이 답변은 원인을 단정하지 않고, feature 점수를 해석하는 보조 정보로만 반영됩니다.</p>

        <div className="mt-5">
          <p className="text-sm font-black text-slate-700">어떤 상황이었나요?</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {contexts.map(([key, label]) => (
              <button key={key} type="button" onClick={() => onChange({ ...value, contextType: key })} className={choiceClass(value.contextType === key)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-slate-700">긴장도는 어느 정도였나요?</p>
            <span className="rounded-md bg-teal-50 px-3 py-1 text-sm font-black text-marine">{value.nervousnessScore}</span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            value={value.nervousnessScore}
            onChange={(event) => onChange({ ...value, nervousnessScore: Number(event.target.value) })}
            className="mt-3 w-full accent-teal-500"
          />
        </div>

        <div className="mt-5">
          <p className="text-sm font-black text-slate-700">말하면서 가장 크게 느낀 어려움은?</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {difficulties.map((difficulty) => (
              <button key={difficulty} type="button" onClick={() => onChange({ ...value, perceivedDifficulty: difficulty })} className={choiceClass(value.perceivedDifficulty === difficulty)}>
                {difficulty}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-5 block text-sm font-black text-slate-700">
          메모
          <textarea
            value={value.userNote ?? ""}
            onChange={(event) => onChange({ ...value, userNote: event.target.value })}
            rows={3}
            placeholder="예: 초반에 긴장했고 중간부터 괜찮아졌어요."
            className="mt-2 w-full resize-none rounded-lg border border-line bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-marine"
          />
        </label>

        <button type="button" onClick={onConfirm} className="mt-5 h-12 w-full rounded-lg bg-ink text-sm font-black text-white">
          self-check 저장하고 분석 준비
        </button>
      </section>
    </div>
  );
}

function choiceClass(active: boolean) {
  return `min-h-10 rounded-lg border px-3 text-sm font-black transition ${
    active ? "border-marine bg-teal-50 text-marine" : "border-line bg-slate-50 text-slate-600 hover:border-slate-300"
  }`;
}
