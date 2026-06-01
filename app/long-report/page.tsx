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

  const deliveryTrend = reports.map((report) => report.deliveryScore);
  const clearMessageTrend = reports.map((report) => report.messageResults?.filter((item) => item.status === "clear").length ?? 0);
  const weakSlideTrend = reports.map((report) => report.slideDeliveryFeedback?.filter((item) => item.status !== "clear").length ?? 0);
  const slideCountTrend = reports.map((report) => report.slideDeliveryFeedback?.length ?? 0);
  const repeatedWeakness = reports.flatMap((report) => report.slideDeliveryFeedback ?? []).filter((item) => item.status !== "clear").map((item) => `${item.slideTitle}: ${item.suggestion}`);
  const nextFocus = reports.map((report) => report.nextFocus ?? "다음 발표에서 핵심 내용 재강조");
  const goodPoints = reports.flatMap((report) => report.savedInsights ?? []).slice(0, 6);

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
                발표가 발생할 때마다 핵심 내용 전달도, 약했던 슬라이드, 다음 발표 초점이 누적됩니다.
              </p>
            </div>
            <Link href="/record?mode=prep" className="inline-flex h-11 items-center justify-center rounded-lg bg-ink px-4 text-sm font-bold text-white">
              다음 발표 준비
            </Link>
          </header>

          <div className="grid gap-5 lg:grid-cols-2">
            <TrendCard title="핵심 내용 전달도 변화" values={deliveryTrend} suffix="점" />
            <TrendCard title="명확히 전달된 핵심 내용" values={clearMessageTrend} suffix="개" />
            <TrendCard title="보완 필요한 슬라이드" values={weakSlideTrend} suffix="개" />
            <TrendCard title="분석된 슬라이드 수" values={slideCountTrend} suffix="장" />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <ListCard title="반복적으로 약한 핵심 내용" items={repeatedWeakness.length ? repeatedWeakness : ["발표 이력이 쌓이면 반복 약점이 표시됩니다."]} />
            <ListCard title="다음 발표 초점" items={nextFocus} />
            <ListCard title="저장된 성장 인사이트" items={goodPoints.length ? goodPoints : ["발표 기록이 쌓이면 인사이트가 누적됩니다."]} />
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
