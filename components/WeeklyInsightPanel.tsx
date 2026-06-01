"use client";

import Link from "next/link";
import type { SpeechReport } from "@/types/speech";

export function WeeklyInsightPanel({ reports }: { reports: SpeechReport[] }) {
  const source = reports.length > 0 ? reports : [];
  const averageDelivery = average(source.map((report) => report.deliveryScore));
  const repeatedWeakness = collectWeakness(source);
  const latest = source[0];
  const previous = source[1];
  const delta = latest && previous ? latest.deliveryScore - previous.deliveryScore : 0;

  return (
    <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-normal text-marine">Growth data</p>
        <h2 className="mt-2 text-2xl font-black text-ink">발표 성장 요약</h2>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Metric label="발표 이력" value={`${source.length}`} />
          <Metric label="평균 핵심 전달도" value={source.length ? `${averageDelivery}` : "-"} />
          <Metric label="최근 개선" value={source.length > 1 ? `${delta > 0 ? "+" : ""}${delta}%` : "-"} />
          <Metric label="다음 초점" value={latest ? "슬라이드 결론" : "-"} />
        </div>
        {source.length < 3 ? (
          <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-500">3회 이상의 발표가 쌓이면 슬라이드별 핵심 내용 전달 흐름을 더 정확히 볼 수 있어요.</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-ink">반복적으로 약한 핵심 내용</h3>
        <div className="mt-4 space-y-2">
          {repeatedWeakness.length > 0 ? repeatedWeakness.map((item) => (
            <div key={item} className="rounded-lg bg-slate-50 px-3 py-3 text-sm font-black leading-6 text-slate-500">{item}</div>
          )) : <p className="text-sm font-bold text-slate-500">발표가 쌓이면 반복적으로 약한 슬라이드/전체 발표 핵심 내용이 표시됩니다.</p>}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-ink">최근 발표 인사이트</h3>
        <div className="mt-4 space-y-2">
          <Insight>{source.length >= 3 ? "최근 3회 발표에서 전체 결론의 핵심 내용 전달이 반복적으로 약했습니다." : "최근 발표에서는 각 슬라이드의 근거가 전체 결론으로 이어지는지 우선 확인하세요."}</Insight>
          <Insight>{delta > 0 ? `지난 발표보다 핵심 내용 전달도가 ${delta}% 향상되었습니다.` : "다음 발표에서는 청중이 기억해야 할 전체 결론을 마지막에 다시 말하세요."}</Insight>
          <Insight>{latest?.savedInsights?.[0] ?? "이번 발표에서는 근거 설명은 충분했지만, 청중이 기억해야 할 결론이 약했습니다."}</Insight>
        </div>
        <div className="mt-5 grid gap-2">
          <Link href="/record?mode=prep" className="flex h-10 items-center justify-center rounded-lg bg-teal-300 text-xs font-black text-slate-950">다음 발표 준비하기</Link>
          <Link href="/record?mode=live" className="flex h-10 items-center justify-center rounded-lg border border-line bg-slate-50 text-xs font-black text-slate-500">발표 후 녹음하기</Link>
        </div>
      </section>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-ink">{value}</p>
    </div>
  );
}

function Insight({ children }: { children: string }) {
  return <p className="rounded-lg border border-line bg-slate-50 p-3 text-sm font-black leading-6 text-slate-500">{children}</p>;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function collectWeakness(reports: SpeechReport[]) {
  const weak = reports
    .flatMap((report) => report.messageResults ?? [])
    .filter((item) => item.status !== "clear")
    .map((item) => item.suggestion.replace(/\[[^\]]+\]\s*/g, ""));
  return Array.from(new Set(weak)).slice(0, 3);
}
