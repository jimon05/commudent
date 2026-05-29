"use client";

import Link from "next/link";
import { contextLabels } from "@/lib/mockData";
import type { SpeechReport } from "@/types/speech";

type Props = {
  report: SpeechReport;
  compact?: boolean;
};

export function SpeechReportCard({ report, compact = false }: Props) {
  const fillerTotal = Object.values(report.fillerCounts).reduce((sum, value) => sum + value, 0);

  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-marine">{contextLabels[report.contextType]}</p>
          <h3 className="mt-2 text-xl font-black text-ink">{report.title}</h3>
          {report.analysisMode === "development_fallback" ? (
            <p className="mt-2 inline-flex rounded-md bg-amber-50 px-2 py-1 text-xs font-black text-amber-800">개발 모드 결과 · 실제 STT 미연결</p>
          ) : null}
          <p className="mt-2 text-sm leading-6 text-slate-600">{report.feedbackSummary}</p>
        </div>
        <Link href={`/report/${report.id}`} className="inline-flex h-10 items-center justify-center rounded-lg bg-ink px-4 text-sm font-black text-white">
          리포트 보기
        </Link>
      </div>

      <div className={`mt-5 grid gap-3 ${compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 lg:grid-cols-4"}`}>
        <Metric label="WPM" value={report.wpm} />
        <Metric label="Filler" value={fillerTotal} />
        <Metric label="Clarity" value={report.clarityScore} />
        <Metric label="Structure" value={report.structureScore} />
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-ink">{value}</p>
    </div>
  );
}
