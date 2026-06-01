import type { Metadata } from "next";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { TrainingSessionBoard } from "@/components/TrainingSessionBoard";

export const metadata: Metadata = {
  title: "Presentation Practice"
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
            <h1 className="mt-3 text-3xl font-black tracking-normal text-ink sm:text-4xl">발표 연습 세션</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              발표 자료와 대본에서 잡은 핵심 내용을 다음 연습 행동으로 연결합니다.
            </p>
          </div>
          <Link href="/record?mode=prep" className="inline-flex h-11 items-center justify-center rounded-lg bg-ink px-4 text-sm font-bold text-white">
            발표 준비하기
          </Link>
        </header>
        <TrainingSessionBoard />
      </div>
    </main>
    </AuthGate>
  );
}
