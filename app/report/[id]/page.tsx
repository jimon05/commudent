"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type React from "react";
import { AuthGate } from "@/components/AuthGate";
import { CauseCheck } from "@/components/CauseCheck";
import { CauseScorePanel } from "@/components/CauseScorePanel";
import { CoachingPlan } from "@/components/CoachingPlan";
import { FeatureBreakdownPanel } from "@/components/FeatureBreakdownPanel";
import { MeasurementMethodPanel } from "@/components/MeasurementMethodPanel";
import { SpeechReportCard } from "@/components/SpeechReportCard";
import { deleteReport, getReportById } from "@/services/reports";
import type { SpeechReport } from "@/types/speech";

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<SpeechReport | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    getReportById(params.id).then(setReport);
  }, [params.id]);

  if (!report) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="rounded-lg border border-line bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-bold text-slate-500">리포트를 불러오는 중입니다.</p>
        </div>
      </main>
    );
  }

  return (
    <AuthGate>
    <main className="min-h-screen bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="text-sm font-bold text-slate-500 transition hover:text-ink">
              대시보드로
            </Link>
            <h1 className="mt-3 text-3xl font-black tracking-normal text-ink sm:text-4xl">{report.title}</h1>
            <p className="mt-2 text-sm font-semibold text-slate-500">Report ID: {report.id}</p>
            {report.analysisMode === "development_fallback" ? (
              <p className="mt-3 inline-flex rounded-md bg-amber-50 px-3 py-2 text-xs font-black text-amber-900">
                개발 모드 결과입니다. OPENAI_API_KEY 또는 STT 요청 실패로 mock transcript가 사용되었을 수 있습니다.
              </p>
            ) : null}
          </div>
          <Link
            href="/record"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-ink px-4 text-sm font-bold text-white transition hover:bg-slate-700 sm:w-auto"
          >
            새 녹음
          </Link>
          <Link
            href="/training"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 sm:w-auto"
          >
            훈련 세션
          </Link>
          <button
            type="button"
            onClick={async () => {
              if (!report) return;
              setIsDeleting(true);
              await deleteReport(report.id);
              router.replace("/");
            }}
            disabled={isDeleting}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 px-4 text-sm font-bold text-rose-700 transition hover:border-rose-200 disabled:opacity-60 sm:w-auto"
          >
            {isDeleting ? "삭제 중" : "리포트 삭제"}
          </button>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-5">
            <SpeechReportCard report={report} />
            <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-ink">전체 요약</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{report.feedbackSummary}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Panel title="가장 강한 원인 후보">
                  {report.causeCandidates.length ? report.causeCandidates.map((item) => item.label).join(", ") : "특정 원인이 강하게 나타나지 않음"}
                </Panel>
                <Panel title="잘한 점">
                  <ul className="space-y-1">
                    {(report.goodPoints ?? ["녹음과 자기보고를 남겨 다음 비교 기준을 만들었습니다."]).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </Panel>
                <Panel title="다음 개선 목표">{report.nextGoal ?? "다음 녹음에서는 핵심 메시지를 더 일찍 배치해보세요."}</Panel>
              </div>
            </div>
            <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-ink">말습관 분석</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Panel title="Filler words">
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(report.fillerCounts).map(([word, count]) => (
                      <div key={word} className="rounded-lg bg-slate-50 p-3 text-sm">
                        <span className="font-bold text-slate-600">{word}</span>
                        <span className="float-right font-black text-ink">{count}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel title="Pause">
                  <p>빈도 {report.pauseData.count}회, 평균 {report.pauseData.averageLengthSeconds}s</p>
                  <p className="mt-2 text-xs text-slate-500">위치: {report.pauseData.points.map((point) => `${point.position}자/${point.label}`).join(", ") || "없음"}</p>
                </Panel>
                <Panel title="문장 길이">
                  <p>평균 {report.averageSentenceLength}어절</p>
                  <p className="mt-2 text-xs text-slate-500">긴 문장 {report.longSentences.length}개</p>
                </Panel>
                <Panel title="자기수정">
                  <p>{report.selfCorrections.length > 0 ? report.selfCorrections.join(", ") : "뚜렷한 자기수정 없음"}</p>
                </Panel>
                <Panel title="WPM">
                  <p>{report.wpm} 어절/분</p>
                </Panel>
              </div>
            </div>

            <MeasurementMethodPanel />

            <FeatureBreakdownPanel featureReport={report.featureReport} />

            <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-ink">표현력 및 어휘 피드백</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Panel title="TTR / MTLD">
                  <p>TTR {report.featureReport?.lexicalFeatures.ttr.toFixed(2) ?? "-"}</p>
                  <p className="mt-1">MTLD {Math.round(report.featureReport?.lexicalFeatures.simplifiedMtld ?? 0)}</p>
                </Panel>
                <Panel title="표현 다양성">
                  <p>{report.lexicalReport?.lexicalDiversityScore ?? "-"}점</p>
                  <p className="mt-2 text-xs text-slate-500">{report.lexicalReport?.summary}</p>
                </Panel>
                <Panel title="반복/모호 표현">
                  <p>{report.lexicalReport?.repeatedGenericWords.map((item) => `${item.expression} ${item.count}회`).join(", ") || "크게 두드러지지 않음"}</p>
                </Panel>
                <Panel title="대체 표현 추천">
                  <p>{report.lexicalReport?.recommendedExpressions.join(", ")}</p>
                </Panel>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-ink">문장별 개선 피드백</h2>
              <div className="mt-4 space-y-3">
                {(report.sentenceFeedback ?? []).map((item) => (
                  <div key={item.original} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <p className="font-black text-ink">원문: {item.original}</p>
                      <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500">
                        {providerLabel(item.source)} · {item.tone}
                      </span>
                    </div>
                    <p className="mt-2">감지된 문제: {item.detected_issue}</p>
                    <p>개선 추천: {item.improved_version}</p>
                    <p>설명: {item.explanation}</p>
                  </div>
                ))}
                {(report.sentenceFeedback ?? []).length === 0 ? (
                  <p className="rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-500">LLM 재작성 대상 문장이 크게 감지되지 않았습니다.</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-ink">AI 개선 버전 비교</h2>
              <div className="mt-4 grid gap-3">
                <Compare label="원본 음성 transcript" text={report.transcript} />
                <Compare label="개선 버전" text={report.improvedVersion} strong />
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <CauseScorePanel report={report} />
            <CoachingPlan report={report} />
            <CauseCheck report={report} />
          </aside>
        </div>
      </div>
    </main>
    </AuthGate>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 text-sm leading-6 text-slate-700">
      <p className="mb-3 font-black text-ink">{title}</p>
      {children}
    </div>
  );
}

function Compare({ label, text, strong = false }: { label: string; text: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 text-sm leading-7 ${strong ? "border-teal-100 bg-teal-50 text-teal-950" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
      <p className="mb-2 text-xs font-black uppercase tracking-normal">{label}</p>
      {text}
    </div>
  );
}

function providerLabel(source: NonNullable<SpeechReport["sentenceFeedback"]>[number]["source"]) {
  if (source === "gemini") return "AI 표현 추천 (Gemini)";
  if (source === "openai") return "AI 표현 추천 (OpenAI)";
  return "기본 표현 추천";
}
