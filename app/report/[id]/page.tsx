"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type React from "react";
import { AuthGate } from "@/components/AuthGate";
import { deleteReport, getReportById } from "@/services/reports";
import type { MessageResult, SpeechReport } from "@/types/speech";

const statusLabels: Record<MessageResult["status"], string> = {
  clear: "핵심 내용 전달됨",
  partial: "일부 전달됨",
  weak: "핵심 내용 약함"
};

const statusClass: Record<MessageResult["status"], string> = {
  clear: "border-teal-200 bg-teal-50 text-marine",
  partial: "border-amber-200 bg-amber-50 text-amber-800",
  weak: "border-rose-200 bg-rose-50 text-rose-700"
};

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

  const keyMessages = report.extractedKeyMessages?.length ? report.extractedKeyMessages : ["핵심 내용 정리 대기 중"];
  const messageResults = report.messageResults ?? [];
  const slideFeedback = report.slideDeliveryFeedback ?? [];
  const dimensionFeedback = report.deliveryDimensionFeedback ?? [];
  const slideCount = slideFeedback.length || countSlides(report.slides);

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
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                발표 자료와 대본에서 확인한 핵심 내용이 각 슬라이드와 전체 발표에서 실제로 전달됐는지 확인합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/record?mode=prep" className="inline-flex h-11 items-center justify-center rounded-lg bg-ink px-4 text-sm font-bold text-white transition hover:bg-slate-700">
                다음 발표 준비
              </Link>
              <button
                type="button"
                onClick={async () => {
                  setIsDeleting(true);
                  await deleteReport(report.id);
                  router.replace("/");
                }}
                disabled={isDeleting}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 px-4 text-sm font-bold text-rose-700 transition hover:border-rose-200 disabled:opacity-60"
              >
                {isDeleting ? "삭제 중" : "리포트 삭제"}
              </button>
            </div>
          </header>

          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="space-y-5">
              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-normal text-marine">Core content delivery</p>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-6xl font-black text-ink">{report.deliveryScore}</p>
                    <p className="mt-2 text-sm font-bold text-slate-500">전체 발표 핵심 내용 전달도</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Metric label="슬라이드" value={slideCount ? `${slideCount}장` : "-"} />
                    <Metric label="핵심 내용" value={`${keyMessages.length}개`} />
                    <Metric label="발표 시간" value={formatDuration(report.durationSeconds)} />
                  </div>
                </div>
                <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">{report.feedbackSummary}</p>
                {report.overallDeliveryGoal ? (
                  <p className="mt-3 rounded-lg border border-teal-100 bg-teal-50 p-4 text-sm font-black leading-6 text-marine">{report.overallDeliveryGoal}</p>
                ) : null}
              </section>

              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-ink">AI가 정리한 발표 핵심 내용</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">입력한 슬라이드와 대본을 바탕으로 발표자가 반드시 전달해야 할 내용을 먼저 정리합니다.</p>
                <div className="mt-4 grid gap-3">
                  {keyMessages.map((message, index) => (
                    <div key={`${message}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-black text-marine">{index === keyMessages.length - 1 ? "전체 발표 핵심" : `슬라이드 핵심 ${index + 1}`}</p>
                      <p className="mt-2 text-sm font-black leading-6 text-ink">{message}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-ink">핵심 내용별 전달 상태</h2>
                <div className="mt-4 space-y-3">
                  {messageResults.map((item) => (
                    <article key={item.message} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <p className="text-sm font-black leading-6 text-ink">{item.message}</p>
                        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${statusClass[item.status]}`}>{statusLabels[item.status]}</span>
                      </div>
                      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{item.evidence}</p>
                      <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-500">{item.suggestion}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-ink">슬라이드별 핵심 내용 전달 피드백</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">각 슬라이드에서 의도한 핵심 내용이 실제 발표 transcript에 남았는지 확인합니다.</p>
                <div className="mt-4 grid gap-3">
                  {slideFeedback.map((item) => (
                    <article key={`${item.slideIndex}-${item.slideTitle}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-black text-marine">슬라이드 {item.slideIndex}</p>
                          <h3 className="mt-1 text-sm font-black text-ink">{item.slideTitle}</h3>
                        </div>
                        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${statusClass[item.status]}`}>{statusLabels[item.status]}</span>
                      </div>
                      <p className="mt-3 text-sm font-black leading-6 text-ink">{item.expectedMessage}</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{item.evidence}</p>
                      <p className="mt-2 rounded-lg bg-white p-3 text-sm font-bold leading-6 text-slate-500">{item.suggestion}</p>
                    </article>
                  ))}
                  {slideFeedback.length === 0 ? (
                    <p className="rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-500">슬라이드별 피드백을 생성하려면 발표 자료를 함께 입력해 주세요.</p>
                  ) : null}
                </div>
              </section>

              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-ink">발표 구간별 피드백</h2>
                <div className="mt-4 grid gap-3">
                  {(report.sectionFeedback ?? []).map((item) => (
                    <Panel key={item.section} title={item.section}>
                      <p>{item.feedback}</p>
                      <p className="mt-2 font-black text-marine">{item.suggestion}</p>
                    </Panel>
                  ))}
                </div>
              </section>
            </section>

            <aside className="space-y-5">
              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-ink">수정된 발표 대본</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">슬라이드별 핵심 내용과 전체 결론이 더 잘 남도록 강조, 쉬어가기, 결론 연결 표시를 넣었습니다.</p>
                <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-sm font-semibold leading-7 text-slate-100">{report.revisedScript ?? report.improvedVersion}</pre>
              </section>

              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-ink">다음 발표를 위한 저장된 인사이트</h2>
                <div className="mt-4 space-y-2">
                  {(report.savedInsights ?? []).map((item) => (
                    <p key={item} className="rounded-lg bg-slate-50 p-3 text-sm font-black leading-6 text-slate-600">{item}</p>
                  ))}
                </div>
                <p className="mt-4 rounded-lg border border-teal-100 bg-teal-50 p-4 text-sm font-black leading-6 text-marine">{report.nextFocus}</p>
              </section>

              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-ink">강조·속도·어휘 보조 피드백</h2>
                <div className="mt-4 grid gap-3">
                  {dimensionFeedback.map((item) => (
                    <Panel key={item.dimension} title={item.label}>
                      <p>{item.feedback}</p>
                      <p className="mt-2 font-black text-marine">{item.suggestion}</p>
                    </Panel>
                  ))}
                  {dimensionFeedback.length === 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Metric label="강조 방해 표현" value={`${Object.values(report.fillerCounts).reduce((sum, count) => sum + count, 0)}회`} />
                      <Metric label="쉬어가기" value={`${report.pauseData.count}회`} />
                      <Metric label="말속도" value={`${report.wpm} 어절/분`} />
                      <Metric label="어휘 반복" value={`${report.repeatedExpressions.length}개`} />
                    </div>
                  ) : null}
                </div>
                <p className="mt-3 text-xs font-bold leading-5 text-slate-500">이 항목들은 핵심 내용 전달을 방해하는 경우에만 보조 피드백으로 참고합니다.</p>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </AuthGate>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
      <p className="mb-2 font-black text-ink">{title}</p>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-ink">{value}</p>
    </div>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (minutes <= 0) return `${rest}초`;
  return `${minutes}분 ${rest}초`;
}

function countSlides(slides?: string) {
  if (!slides?.trim()) return 0;
  return slides
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}
