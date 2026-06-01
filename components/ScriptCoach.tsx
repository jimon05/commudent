"use client";

import { useMemo, useState } from "react";
import { coachScript } from "@/services/coachingService";

const defaultScript =
  "Commudent는 발표 자료와 대본을 바탕으로 발표의 핵심 내용을 먼저 정리합니다. 이후 사용자가 연습 녹음을 하면 각 슬라이드와 발표 전체에서 그 핵심 내용이 실제로 잘 전달되었는지 확인합니다. 강조, 속도, 어휘 피드백은 핵심 내용 전달을 돕는 보조 기준으로 사용합니다.";

export function ScriptCoach() {
  const [script, setScript] = useState(defaultScript);
  const result = useMemo(() => coachScript(script), [script]);

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-ink">대본 입력</h2>
        <textarea
          value={script}
          onChange={(event) => setScript(event.target.value)}
          className="mt-4 min-h-80 w-full rounded-lg border border-line p-4 text-sm leading-7 outline-none focus:border-marine focus:ring-2 focus:ring-teal-100"
        />
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="font-bold text-slate-500">예상 발표시간</p>
            <p className="mt-1 text-2xl font-black text-ink">{result.estimatedSeconds}초</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="font-bold text-slate-500">긴 문장 수정 후보</p>
            <p className="mt-1 text-2xl font-black text-ink">{result.longSentenceFixes.length}</p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-ink">AI 개선 버전</h2>
          <div className="mt-4 grid gap-3">
            <TextBlock label="원문" text={result.original} />
            <TextBlock label="개선" text={result.improved} tone="teal" />
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-ink">전달 코칭</h2>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-ink">핵심 메시지</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{result.keyMessage || "핵심 메시지를 첫 문장에 더 명확히 두는 것이 좋습니다."}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ListBlock title="PREP 구조 점검" items={result.prepChecklist.map((item) => `${item.label}: ${item.present ? "확인됨" : "보강 필요"}`)} />
            <ListBlock title="강조 문장" items={result.emphasisSentences} />
            <ListBlock title="쉬어갈 위치" items={result.pauseSuggestions} />
            <ListBlock title="표현 개선 제안" items={result.expressionSuggestions} />
          </div>
          {result.longSentenceFixes.length > 0 ? (
            <div className="mt-4 space-y-3">
              {result.longSentenceFixes.map((fix) => (
                <div key={fix.before} className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm leading-6">
                  <p className="font-bold text-amber-900">긴 문장</p>
                  <p className="mt-1 text-slate-700">{fix.before}</p>
                  <p className="mt-3 font-bold text-amber-900">수정 제안</p>
                  <p className="mt-1 text-slate-700">{fix.after}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function TextBlock({ label, text, tone = "slate" }: { label: string; text: string; tone?: "slate" | "teal" }) {
  return (
    <div className={`rounded-lg border p-4 text-sm leading-7 ${tone === "teal" ? "border-teal-100 bg-teal-50 text-teal-950" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
      <p className="mb-2 text-xs font-black uppercase tracking-normal">{label}</p>
      {text}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-sm font-black text-ink">{title}</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm leading-6 text-slate-600">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
