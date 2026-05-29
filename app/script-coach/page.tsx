import type { Metadata } from "next";
import Link from "next/link";
import { ScriptCoach } from "@/components/ScriptCoach";

export const metadata: Metadata = {
  title: "Script Coach"
};

export default function ScriptCoachPage() {
  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="text-sm font-bold text-slate-500 transition hover:text-ink">
              대시보드로
            </Link>
            <h1 className="mt-3 text-3xl font-black tracking-normal text-ink sm:text-4xl">Script Delivery Coaching</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              녹음 분석의 선행 단계가 아닌 독립 기능입니다. 대본의 핵심 메시지, PREP 구조, pause, 강조, 예상 발표시간을 미리 점검합니다.
            </p>
          </div>
          <Link
            href="/record"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-ink px-4 text-sm font-bold text-white transition hover:bg-slate-700 sm:w-auto"
          >
            녹음하기
          </Link>
        </header>

        <ScriptCoach />
      </div>
    </main>
  );
}
