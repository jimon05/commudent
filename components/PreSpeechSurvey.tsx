"use client";

import type { PreSpeechSurveyInput } from "@/types/speech";

type Props = {
  value: PreSpeechSurveyInput;
  onChange: (value: PreSpeechSurveyInput) => void;
};

const questions: Array<{ key: keyof PreSpeechSurveyInput; label: string }> = [
  { key: "nervousnessScore", label: "오늘 긴장도" },
  { key: "preparednessScore", label: "오늘 준비도" },
  { key: "confidenceScore", label: "오늘 자신감" },
  { key: "conditionScore", label: "오늘 컨디션" }
];

export function PreSpeechSurvey({ value, onChange }: Props) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-ink">발표 전 자기보고</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {questions.map((question) => (
          <label key={question.key} className="block rounded-lg border border-slate-200 p-4">
            <span className="flex items-center justify-between gap-3 text-sm font-bold text-slate-700">
              {question.label}
              <span className="text-base text-marine">{value[question.key]}</span>
            </span>
            <input
              type="range"
              min="1"
              max="5"
              value={value[question.key]}
              onChange={(event) => onChange({ ...value, [question.key]: Number(event.target.value) })}
              className="mt-3 w-full accent-teal-700"
            />
            <div className="mt-1 flex justify-between text-xs font-semibold text-slate-400">
              <span>1</span>
              <span>5</span>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
