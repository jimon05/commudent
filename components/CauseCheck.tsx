"use client";

import { useState } from "react";
import type { CauseFeedback, SpeechReport } from "@/types/speech";

const options = ["긴장했다", "생각이 정리되지 않았다", "너무 급하게 말했다", "대본이 기억나지 않았다", "준비가 부족했다", "특별한 문제 없었다", "기타"];

export function CauseCheck({ report }: { report: SpeechReport }) {
  const [feedback, setFeedback] = useState<CauseFeedback>({ selectedCauses: [], userNote: "" });
  const [saved, setSaved] = useState(false);

  function toggle(label: string) {
    setSaved(false);
    setFeedback((current) => ({
      ...current,
      selectedCauses: current.selectedCauses.includes(label)
        ? current.selectedCauses.filter((item) => item !== label)
        : [...current.selectedCauses, label]
    }));
  }

  function save() {
    window.localStorage.setItem(`cause-feedback-${report.id}`, JSON.stringify(feedback));
    setSaved(true);
  }

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-ink">원인 확인 질문</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">오늘 말하면서 어떤 느낌이 가장 컸나요? 선택값은 `cause_feedback` 테이블에 저장될 데이터입니다.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option} className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={feedback.selectedCauses.includes(option)} onChange={() => toggle(option)} className="h-4 w-4 accent-teal-700" />
            {option}
          </label>
        ))}
      </div>
      <textarea
        value={feedback.userNote}
        onChange={(event) => {
          setSaved(false);
          setFeedback({ ...feedback, userNote: event.target.value });
        }}
        placeholder="기타 메모"
        className="mt-3 min-h-24 w-full rounded-lg border border-line p-3 text-sm outline-none focus:border-marine focus:ring-2 focus:ring-teal-100"
      />
      <button type="button" onClick={save} className="mt-3 h-10 rounded-lg bg-ink px-4 text-sm font-black text-white">
        피드백 저장
      </button>
      {saved ? <span className="ml-3 text-sm font-bold text-marine">저장됨</span> : null}
    </section>
  );
}
