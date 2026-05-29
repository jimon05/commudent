import type { Metadata } from "next";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { Recorder } from "@/components/Recorder";

export const metadata: Metadata = {
  title: "Record Practice"
};

export default function RecordPage() {
  return (
    <AuthGate>
    <main className="min-h-screen bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="text-sm font-bold text-slate-500 transition hover:text-ink">
              대시보드로
            </Link>
            <h1 className="mt-3 text-3xl font-black tracking-normal text-ink sm:text-4xl">녹음 및 자기보고</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              발표 전 상태를 함께 저장해 같은 말습관이 왜 나타나는지 가능성 단위로 추적합니다.
            </p>
          </div>
          <Link
            href="/script-coach"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 sm:w-auto"
          >
            대본 코치 열기
          </Link>
        </header>

        <Recorder />
      </div>
    </main>
    </AuthGate>
  );
}
