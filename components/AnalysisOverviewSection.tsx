const analysisGroups = [
  { title: "발화 유창성", metrics: "filler ratio · hesitation · self repair" },
  { title: "전달 특성", metrics: "WPM · sentence length · clarity" },
  { title: "구조화", metrics: "PREP · topic drift · key message timing" },
  { title: "표현력", metrics: "TTR · MTLD · repeated expression" },
  { title: "상황 정보", metrics: "context · self-check nervousness" }
];

export function AnalysisOverviewSection() {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-marine">Analysis model</p>
          <h2 className="mt-2 text-xl font-black text-ink">Commudent는 이렇게 분석합니다</h2>
        </div>
        <p className="max-w-lg text-sm font-semibold leading-6 text-slate-500">녹음 기반 feature와 self-check를 함께 보고, 하나의 말습관을 단정하지 않습니다.</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {analysisGroups.map((group) => (
          <article key={group.title} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-black text-ink">{group.title}</p>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-500">{group.metrics}</p>
          </article>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3 text-[11px] font-black text-slate-400">
        <span className="rounded-full border border-line bg-slate-50 px-3 py-1">국내 발표불안 연구</span>
        <span className="rounded-full border border-line bg-slate-50 px-3 py-1">KCI 스피치 교육 연구</span>
        <span className="rounded-full border border-line bg-slate-50 px-3 py-1">한국스피치커뮤니케이션학회</span>
      </div>
    </section>
  );
}
