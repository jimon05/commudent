"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnalysisOverviewSection } from "@/components/AnalysisOverviewSection";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { RecordingHistoryList } from "@/components/RecordingHistoryList";
import { WeeklyInsightPanel } from "@/components/WeeklyInsightPanel";
import { getOnboardingStatus } from "@/services/profileService";
import { listRecentReports } from "@/services/reports";
import type { SpeechReport } from "@/types/speech";

export default function HomePage() {
  const [reports, setReports] = useState<SpeechReport[]>([]);
  const [profileName, setProfileName] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    let mounted = true;
    getOnboardingStatus().then(({ profile, onboardingCompleted }) => {
      if (!mounted) return;
      setProfileName(onboardingCompleted ? profile?.nickname ?? "Commudent" : "방문자");
      setIsLoadingProfile(false);
      listRecentReports().then((items) => {
        if (mounted) setReports(items);
      });
    });
    return () => {
      mounted = false;
    };
  }, []);

  const latestReport = reports[0];
  const recordCountLabel = useMemo(() => `${reports.length}개 기록`, [reports.length]);

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="flex min-h-screen">
        <DashboardSidebar />

        <section className="min-w-0 flex-1 px-4 pb-24 pt-4 sm:px-6 lg:px-7 lg:pb-8">
          <header className="mb-5 flex flex-col gap-4 rounded-lg border border-line bg-white p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-5xl font-black tracking-normal text-ink sm:text-6xl">Commudent</h1>
              <p className="mt-3 max-w-2xl text-base font-black leading-7 text-slate-500 sm:text-lg">
                말과 전달 사이의 차이를 줄여주는 발표 지원 서비스
              </p>
              <p className="mt-3 text-xs font-black text-slate-400">{isLoadingProfile ? "발표 이력을 불러오는 중입니다." : `${profileName}님의 발표 성장 기록`}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-line bg-slate-50 px-4 py-2 text-xs font-black text-slate-300">{recordCountLabel}</span>
              {latestReport ? <span className="rounded-full border border-teal-300/30 bg-teal-50 px-4 py-2 text-xs font-black text-marine">최근 전달도 {latestReport.deliveryScore}</span> : null}
            </div>
          </header>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-5">
              <section className="grid gap-4 md:grid-cols-2">
                <ServiceCard
                  eyebrow="Before"
                  title="발표 전 서비스"
                  body="대본과 자료에서 핵심 메시지 3개를 추출하고, 강조·속도·쉬어갈 구간을 연습 기준으로 설정합니다."
                  href="/record?mode=prep"
                  cta="발표 준비 시작"
                />
                <ServiceCard
                  eyebrow="After"
                  title="발표 후 서비스"
                  body="실제 발표 녹음을 저장하고, 의도한 메시지가 얼마나 전달됐는지 리포트와 다음 발표 인사이트로 남깁니다."
                  href="/record?mode=live"
                  cta="발표 녹음하기"
                />
              </section>
              <AnalysisOverviewSection />
              <RecordingHistoryList reports={reports} />
            </div>
            <WeeklyInsightPanel reports={reports} />
          </div>
        </section>
      </div>
    </main>
  );
}

function ServiceCard({ eyebrow, title, body, href, cta }: { eyebrow: string; title: string; body: string; href: string; cta: string }) {
  return (
    <Link href={href} className="rounded-lg border border-line bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md">
      <p className="text-xs font-black uppercase tracking-normal text-marine">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-black text-ink">{title}</h2>
      <p className="mt-3 min-h-16 text-sm font-semibold leading-6 text-slate-500">{body}</p>
      <span className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-ink px-4 text-sm font-black text-white">{cta}</span>
    </Link>
  );
}
