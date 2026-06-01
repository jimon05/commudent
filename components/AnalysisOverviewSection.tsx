const analysisGroups = [
  { title: "발표 입력", metrics: "slides · script · time limit" },
  { title: "핵심 내용 정리", metrics: "slide core · overall core" },
  { title: "연습 발표", metrics: "recording · STT · transcript" },
  { title: "전달 확인", metrics: "slide-level · whole presentation" },
  { title: "다음 준비", metrics: "saved insights · next focus" }
];

export function AnalysisOverviewSection() {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-marine">Service flow</p>
          <h2 className="mt-2 text-xl font-black text-ink">Commudent는 발표 준비와 연습 피드백을 이렇게 연결합니다</h2>
        </div>
        <p className="max-w-lg text-sm font-semibold leading-6 text-slate-500">사용자가 넣은 슬라이드와 대본에서 핵심 내용을 정리하고, 발표 후 각 슬라이드와 전체 발표가 그 내용을 전달했는지 확인합니다.</p>
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
        <span className="rounded-full border border-line bg-slate-50 px-3 py-1">슬라이드별 핵심 내용</span>
        <span className="rounded-full border border-line bg-slate-50 px-3 py-1">전체 발표 전달도</span>
        <span className="rounded-full border border-line bg-slate-50 px-3 py-1">강조·속도·어휘 보조 피드백</span>
      </div>
    </section>
  );
}
