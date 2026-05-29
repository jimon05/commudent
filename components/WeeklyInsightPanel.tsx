"use client";

import Link from "next/link";
import type { SpeechReport } from "@/types/speech";

export function WeeklyInsightPanel({ reports }: { reports: SpeechReport[] }) {
  const weekReports = reports.filter((report) => Date.now() - new Date(report.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000);
  const source = weekReports.length > 0 ? weekReports : reports;
  const totalSeconds = source.reduce((sum, report) => sum + report.durationSeconds, 0);
  const averageClarity = average(source.map((report) => report.clarityScore));
  const averageLexical = average(source.map((report) => report.lexicalReport?.lexicalDiversityScore ?? 0).filter(Boolean));
  const repeatedTop = collectRepeatedExpressions(source).slice(0, 3);
  const improvements = buildImprovements(source);
  const causeChanges = source.slice(0, 3).map((report) => report.causeCandidates[0]?.label ?? "특정 원인 낮음");

  return (
    <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-normal text-marine">Long-term insight</p>
        <h2 className="mt-2 text-2xl font-black text-ink">장기 리포트 요약</h2>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Metric label="녹음 수" value={`${source.length}`} />
          <Metric label="말하기 시간" value={formatMinutes(totalSeconds)} />
          <Metric label="Clarity" value={source.length ? `${averageClarity}` : "-"} />
          <Metric label="표현 다양성" value={source.length ? `${averageLexical}` : "-"} />
        </div>
        {source.length < 3 ? (
          <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-500">3개 이상의 녹음이 쌓이면 주간 리포트를 생성할 수 있어요.</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-ink">최근 3회 원인 후보 변화</h3>
        <div className="mt-4 space-y-2">
          {causeChanges.length > 0 ? causeChanges.map((item, index) => (
            <div key={`${item}-${index}`} className="rounded-lg bg-slate-50 px-3 py-3 text-sm font-black text-slate-500">{index + 1}. {item}</div>
          )) : <p className="text-sm font-bold text-slate-500">녹음이 쌓이면 변화가 표시됩니다.</p>}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-ink">반복 표현 TOP3</h3>
        <div className="mt-4 space-y-2">
          {repeatedTop.length > 0 ? (
            repeatedTop.map((item) => (
              <div key={item.expression} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3">
                <span className="text-sm font-black text-slate-300">{item.expression}</span>
                <span className="text-sm font-black text-marine">{item.count}회</span>
              </div>
            ))
          ) : (
            <p className="text-sm font-bold leading-6 text-slate-500">아직 반복 표현을 집계할 녹음이 없습니다.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-ink">최근 개선된 지표</h3>
        <div className="mt-4 space-y-2">
          {improvements.map((item) => (
            <div key={item} className="rounded-lg border border-line bg-slate-50 p-3 text-sm font-black text-slate-300">{item}</div>
          ))}
        </div>
        <div className="mt-5 grid gap-2">
          <Link href="/long-report" className="flex h-10 items-center justify-center rounded-lg border border-line bg-slate-50 text-xs font-black text-slate-300">주간 리포트 보기</Link>
          <Link href="/long-report" className="flex h-10 items-center justify-center rounded-lg border border-line bg-slate-50 text-xs font-black text-slate-300">월간 리포트 보기</Link>
          <Link href="/training" className="flex h-10 items-center justify-center rounded-lg bg-teal-300 text-xs font-black text-slate-950">다음 훈련 추천 받기</Link>
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

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function formatMinutes(seconds: number) {
  if (!seconds) return "0분";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes}분`;
}

function collectRepeatedExpressions(reports: SpeechReport[]) {
  const counts = new Map<string, number>();
  reports.forEach((report) => {
    report.repeatedExpressions.forEach((item) => counts.set(item.expression, (counts.get(item.expression) ?? 0) + item.count));
    report.lexicalReport?.repeatedGenericWords.forEach((item) => counts.set(item.expression, (counts.get(item.expression) ?? 0) + item.count));
  });
  return Array.from(counts.entries())
    .map(([expression, count]) => ({ expression, count }))
    .sort((a, b) => b.count - a.count);
}

function buildImprovements(reports: SpeechReport[]) {
  if (reports.length < 2) return ["녹음이 쌓이면 filler 변화와 속도 안정화를 비교합니다.", "표현 다양성 점수 변화가 이곳에 표시됩니다."];
  const latest = reports[0];
  const previous = reports[1];
  const fillerLatest = Object.values(latest.fillerCounts).reduce((sum, value) => sum + value, 0);
  const fillerPrevious = Object.values(previous.fillerCounts).reduce((sum, value) => sum + value, 0);
  const lexicalDelta = (latest.lexicalReport?.lexicalDiversityScore ?? 0) - (previous.lexicalReport?.lexicalDiversityScore ?? 0);
  return [
    fillerLatest <= fillerPrevious ? `filler 사용 ${Math.max(0, fillerPrevious - fillerLatest)}회 감소` : "filler 변화 추적 중",
    Math.abs(latest.wpm - 115) <= Math.abs(previous.wpm - 115) ? "말 속도 안정화" : "속도 조절 훈련 추천",
    lexicalDelta >= 0 ? `표현 다양성 +${lexicalDelta}점` : "표현 다양성 회복 훈련 추천"
  ];
}
