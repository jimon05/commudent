"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { listRecentReports } from "@/services/reports";
import type { SpeechReport } from "@/types/speech";

export default function LongReportPage() {
  const [reports, setReports] = useState<SpeechReport[]>([]);

  useEffect(() => {
    listRecentReports().then(setReports);
  }, []);

  const fillerTrend = reports.map((report) => Object.values(report.fillerCounts).reduce((sum, count) => sum + count, 0));
  const repeatedTrend = reports.map((report) => report.repeatedExpressions.length);
  const clarityTrend = reports.map((report) => report.clarityScore);
  const lexicalTrend = reports.map((report) => report.lexicalReport?.lexicalDiversityScore ?? 0);
  const causeTrend = reports.map((report) => report.causeCandidates[0]?.label ?? "특정 원인 낮음");
  const trainingTrend = reports.map((report) => report.coachingPlan.recommendedTraining[0] ?? "structure_training");
  const goodPoints = reports.flatMap((report) => report.goodPoints ?? []).slice(0, 6);

  return (
    <AuthGate>
      <main className="min-h-screen bg-paper px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-5 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Link href="/" className="text-sm font-bold text-slate-500 transition hover:text-ink">
                대시보드로
              </Link>
              <h1 className="mt-3 text-3xl font-black tracking-normal text-ink sm:text-4xl">장기 성장 리포트</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                이 리포트는 녹음 기반 분석 결과 누적만 사용합니다. 스크립트 코칭 결과는 핵심 통계에 포함하지 않습니다.
              </p>
            </div>
            <Link href="/record" className="inline-flex h-11 items-center justify-center rounded-lg bg-ink px-4 text-sm font-bold text-white">
              새 녹음
            </Link>
          </header>

          <div className="grid gap-5 lg:grid-cols-2">
            <TrendCard title="filler 변화 추이" values={fillerTrend} suffix="회" />
            <TrendCard title="repeated expression 변화" values={repeatedTrend} suffix="개" />
            <TrendCard title="clarity score 변화" values={clarityTrend} suffix="점" />
            <TrendCard title="lexical diversity score 변화" values={lexicalTrend} suffix="점" />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <ListCard title="top cause 변화" items={causeTrend} />
            <ListCard title="훈련 추천 변화" items={trainingTrend} />
            <ListCard title="잘한 점 누적" items={goodPoints.length ? goodPoints : ["녹음이 쌓이면 잘한 점이 누적됩니다."]} />
          </div>
        </div>
      </main>
    </AuthGate>
  );
}

function TrendCard({ title, values, suffix }: { title: string; values: number[]; suffix: string }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-ink">{title}</h2>
      <div className="mt-4 flex h-32 items-end gap-2 rounded-lg bg-slate-50 p-3">
        {values.length ? values.slice(0, 8).reverse().map((value, index) => (
          <div key={`${value}-${index}`} className="flex flex-1 flex-col items-center gap-2">
            <div className="w-full rounded-t bg-teal-300" style={{ height: `${Math.max(8, Math.min(100, value))}%` }} />
            <span className="text-[10px] font-black text-slate-500">{value}{suffix}</span>
          </div>
        )) : <p className="text-sm font-bold text-slate-500">녹음 기반 리포트가 아직 없습니다.</p>}
      </div>
    </section>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-ink">{title}</h2>
      <div className="mt-4 space-y-2">
        {items.slice(0, 6).map((item, index) => (
          <div key={`${item}-${index}`} className="rounded-lg bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-600">{item}</div>
        ))}
      </div>
    </section>
  );
}
