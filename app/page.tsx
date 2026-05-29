"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnalysisOverviewSection } from "@/components/AnalysisOverviewSection";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { RecordingHistoryList } from "@/components/RecordingHistoryList";
import { WeeklyInsightPanel } from "@/components/WeeklyInsightPanel";
import { getOnboardingStatus } from "@/services/profileService";
import { listRecentReports } from "@/services/reports";
import type { SpeechReport } from "@/types/speech";

export default function HomePage() {
  const router = useRouter();
  const [reports, setReports] = useState<SpeechReport[]>([]);
  const [profileName, setProfileName] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    let mounted = true;
    getOnboardingStatus().then(({ profile, onboardingCompleted }) => {
      if (!mounted) return;
      if (!onboardingCompleted) {
        router.replace("/onboarding");
        return;
      }
      setProfileName(profile?.nickname ?? "Commudent");
      setIsLoadingProfile(false);
      listRecentReports().then((items) => {
        if (mounted) setReports(items);
      });
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  const latestReport = reports[0];
  const recordCountLabel = useMemo(() => `${reports.length}개 기록`, [reports.length]);

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="flex min-h-screen">
        <DashboardSidebar />

        <section className="min-w-0 flex-1 px-4 pb-24 pt-4 sm:px-6 lg:px-7 lg:pb-8">
          <header className="mb-5 flex flex-col gap-4 rounded-lg border border-line bg-white p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-normal text-marine">Speech archive dashboard</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-ink sm:text-4xl">
                {isLoadingProfile ? "말하기 기록을 불러오는 중입니다." : `${profileName}님의 말하기 기록`}
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">녹음 기록과 분석 결과를 한곳에서 다시 보고 장기 변화를 확인합니다.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-line bg-slate-50 px-4 py-2 text-xs font-black text-slate-300">{recordCountLabel}</span>
              {latestReport ? <span className="rounded-full border border-teal-300/30 bg-teal-50 px-4 py-2 text-xs font-black text-marine">최근 clarity {latestReport.clarityScore}</span> : null}
            </div>
          </header>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-5">
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
