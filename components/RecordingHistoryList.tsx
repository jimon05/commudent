"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { contextLabels } from "@/lib/mockData";
import type { ContextType, SpeechReport } from "@/types/speech";

const filters: Array<{ label: string; value: "all" | ContextType }> = [
  { label: "전체", value: "all" },
  { label: "발표", value: "presentation" },
  { label: "면접", value: "interview" },
  { label: "회의", value: "meeting" },
  { label: "일상 대화", value: "daily" }
];

export function RecordingHistoryList({ reports }: { reports: SpeechReport[] }) {
  const [filter, setFilter] = useState<"all" | ContextType>("all");
  const [query, setQuery] = useState("");

  const filteredReports = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return reports.filter((report) => {
      const matchFilter = filter === "all" || report.contextType === filter;
      const matchQuery = !normalized || `${report.title} ${report.transcript}`.toLowerCase().includes(normalized);
      return matchFilter && matchQuery;
    });
  }, [filter, query, reports]);

  return (
    <section className="rounded-lg border border-line bg-white shadow-sm">
      <div className="border-b border-line p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-marine">Recording history</p>
            <h2 className="mt-2 text-2xl font-black text-ink">녹음 기록 및 피드백 내역</h2>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제목 또는 transcript 검색"
            className="h-11 w-full rounded-lg border border-line bg-slate-50 px-4 text-sm font-bold outline-none focus:border-marine xl:w-72"
          />
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`h-9 shrink-0 rounded-full border px-4 text-xs font-black ${filter === item.value ? "border-teal-300/50 bg-teal-50 text-marine" : "border-line bg-slate-50 text-slate-400"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {filteredReports.length === 0 ? (
        <div className="p-8 text-center">
          <h3 className="text-xl font-black text-ink">아직 분석된 녹음이 없습니다.</h3>
          <p className="mt-2 text-sm font-semibold text-slate-500">첫 녹음을 만들면 리포트와 표현 피드백이 이곳에 쌓입니다.</p>
        </div>
      ) : (
        <div className="divide-y divide-white/10">
          {filteredReports.map((report) => {
            const topCause = report.causeCandidates[0]?.label ?? "확인 중";
            const topExpression = report.repeatedExpressions[0]?.expression ?? report.lexicalReport?.repeatedGenericWords[0]?.expression ?? "없음";
            return (
              <Link key={report.id} href={`/report/${report.id}`} className="grid gap-3 p-5 transition hover:bg-white/5 xl:grid-cols-[0.58fr_minmax(220px,1.1fr)_0.58fr_0.8fr_0.5fr_0.5fr_0.62fr] xl:items-center">
                <span className="hidden text-sm font-bold text-slate-400 xl:block">{formatDate(report.createdAt)}</span>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-black text-ink">{report.title}</h3>
                  <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-500">{report.transcript || "transcript 저장 대기 중"}</p>
                  <p className="mt-2 text-xs font-bold text-slate-500 xl:hidden">{formatDate(report.createdAt)} · {formatDuration(report.durationSeconds)}</p>
                </div>
                <span className="w-fit rounded-full border border-line bg-slate-50 px-3 py-1 text-xs font-black text-slate-300">{contextLabels[report.contextType]}</span>
                <span className="text-sm font-bold text-slate-300">{topCause}</span>
                <span className="text-sm font-black text-marine">{report.clarityScore}점</span>
                <span className="text-sm font-black text-marine">{report.lexicalReport?.lexicalDiversityScore ?? "-"}점</span>
                <span className="text-sm font-bold text-slate-400">{topExpression}</span>
                <div className="flex items-center justify-between gap-3 xl:block">
                  <span className="text-sm font-bold text-slate-400">{formatDuration(report.durationSeconds)}</span>
                  <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-black text-marine xl:mt-2 xl:inline-block">리포트 완료</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (minutes <= 0) return `${rest}초`;
  return `${minutes}분 ${rest}초`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
