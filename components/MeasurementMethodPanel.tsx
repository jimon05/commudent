"use client";

export function MeasurementMethodPanel() {
  const rows = [
    {
      metric: "pause_score / pause_lack_score",
      method: "transcript 기반 추정",
      note: "`...`, `…` 표기와 녹음 길이 기반 추정 pause를 사용합니다. 실제 오디오 silence detection 결과가 아닙니다."
    },
    {
      metric: "prep_failure_score",
      method: "규칙 기반 구조 분석",
      note: "주장, 이유, 예시, 결론 복귀를 나타내는 텍스트 marker를 찾아 PREP 형태를 추정합니다."
    },
    {
      metric: "topic_drift_score",
      method: "규칙 기반 구조 분석",
      note: "첫 문장 토큰과 이후 문장 토큰의 overlap으로 주제 이탈 가능성을 추정합니다. 의미 embedding 기반 분석은 아직 적용하지 않았습니다."
    },
    {
      metric: "emphasis_problem_score",
      method: "미측정 placeholder",
      note: "현재 pitch/intensity 분석이 없어 0으로 고정합니다. 따라서 리포트는 강조나 억양 부족을 단정하지 않습니다."
    }
  ];

  return (
    <section className="rounded-lg border border-amber-100 bg-amber-50 p-5 shadow-sm">
      <h2 className="text-lg font-black text-amber-950">측정 방식 및 분석 신뢰도</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">
        현재 리포트는 STT transcript 기반 feature를 중심으로 계산합니다. 실제 오디오 신호에서 직접 측정하지 않는 지표는 추정 또는 규칙 기반으로 표시합니다.
      </p>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <article key={row.metric} className="rounded-lg border border-amber-200 bg-white/70 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-black text-ink">{row.metric}</p>
              <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">{row.method}</span>
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{row.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
