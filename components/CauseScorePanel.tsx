"use client";

import { causeDefinitions, interpretCauseScore } from "@/services/causeInferenceService";
import type { CauseType, SpeechReport } from "@/types/speech";

const causeOrder: CauseType[] = ["anxiety_pressure", "cognitive_load", "discourse_structure", "habitual_pattern", "delivery_regulation"];

export function CauseScorePanel({ report }: { report: SpeechReport }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-ink">보조 전달 지표</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">이 영역은 핵심 내용 전달을 방해할 수 있는 보조 신호만 참고합니다.</p>
      <div className="mt-4 grid gap-2">
        {causeOrder.map((type) => {
          const score = report.causeScores[type] ?? 0;
          const candidate = report.causeCandidates.find((item) => item.type === type);
          return (
            <article key={type} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-ink">{causeDefinitions[type].label}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{interpretCauseScore(score)} · 단정 금지</p>
                </div>
                <p className="text-xl font-black text-marine">{Math.round(score * 100)}%</p>
              </div>
              <ul className="mt-3 space-y-1 text-sm font-semibold leading-6 text-slate-600">
                {(candidate?.evidence ?? defaultEvidence(type)).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {candidate?.influentialFeatures?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {candidate.influentialFeatures.map((feature) => (
                    <span key={feature.label} className="rounded-full border border-line bg-white px-3 py-1 text-xs font-black text-slate-500">
                      {feature.label} {Math.round(feature.value * 100)}%
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {report.causeCandidates.length === 0 ? (
        <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
          이번 발표에서는 핵심 내용 전달을 크게 방해하는 보조 신호가 두드러지지 않았습니다.
        </p>
      ) : null}
    </section>
  );
}

function defaultEvidence(type: CauseType) {
  return [`${causeDefinitions[type].description} 관련 보조 신호가 낮거나 제한적으로 관찰되었습니다.`];
}
