import type { Metadata } from "next";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { TrainingSessionBoard } from "@/components/TrainingSessionBoard";

export const metadata: Metadata = {
  title: "Training Sessions"
};

export default function TrainingPage() {
  return (
    <AuthGate>
    <main className="min-h-screen bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="text-sm font-bold text-slate-500 transition hover:text-ink">
              대시보드로
            </Link>
            <h1 className="mt-3 text-3xl font-black tracking-normal text-ink sm:text-4xl">유형별 훈련 세션</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              단순 피드백에서 끝나지 않고, 현재 가능성이 높은 원인 후보를 다음 연습 행동으로 바꿉니다.
            </p>
          </div>
          <Link href="/record" className="inline-flex h-11 items-center justify-center rounded-lg bg-ink px-4 text-sm font-bold text-white">
            녹음하기
          </Link>
        </header>
        <TrainingSessionBoard />
      </div>
    </main>
    </AuthGate>
  );
}
