"use client";

import Link from "next/link";
import type { SpeechReport } from "@/types/speech";

export function RecentFeedbackCards({ reports }: { reports: SpeechReport[] }) {
  const latest = reports[0];

  if (!latest) {
    return (
      <section className="rounded-lg border border-line bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-normal text-marine">Next action</p>
        <h2 className="mt-3 text-2xl font-black text-ink">첫 녹음을 시작해보세요.</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">발표 기록이 쌓이면 핵심 내용 전달도와 다음 발표 초점이 이곳에 자동으로 정리됩니다.</p>
        <Link href="/record?mode=prep" className="mt-5 inline-flex h-11 items-center rounded-lg bg-teal-300 px-5 text-sm font-black text-slate-950">
          발표 준비하기
        </Link>
      </section>
    );
  }

  const lexical = latest.lexicalReport;
  const genericWords = lexical?.repeatedGenericWords.slice(0, 3).map((item) => item.expression).join("/");
  const expressionProvider = latest.sentenceFeedback?.[0]?.source;
  const speedMessage = latest.wpm > 135 ? "말 속도가 평균보다 빠르게 측정되었습니다." : latest.wpm < 85 ? "말 속도가 느리게 측정되어 핵심 전달이 늘어질 수 있습니다." : "말 속도는 비교적 안정적입니다.";
  const weakSlide = latest.slideDeliveryFeedback?.find((item) => item.status !== "clear");
  const clearCount = latest.messageResults?.filter((item) => item.status === "clear").length ?? 0;

  const cards = [
    {
      title: "핵심 내용 전달도",
      body: `이번 발표 전달도 ${latest.deliveryScore}점`,
      meta: `${clearCount}개 핵심 내용이 명확히 전달됨`,
      cta: "전달 리포트 보기",
      href: `/report/${latest.id}`
    },
    {
      title: "보완할 슬라이드",
      body: weakSlide ? `${weakSlide.slideTitle} 구간 보강 필요` : "슬라이드 핵심 내용이 고르게 전달되었습니다.",
      meta: weakSlide?.suggestion ?? "다음 발표에서도 슬라이드별 결론을 유지하세요.",
      cta: "다음 발표 준비",
      href: "/record?mode=prep"
    },
    {
      title: "어휘 추천",
      body: genericWords ? `${genericWords} 같은 범용 표현이 반복되었습니다.` : lexical?.summary ?? "표현 다양성 데이터가 준비 중입니다.",
      meta: `${providerLabel(expressionProvider)} · ${lexical?.recommendedExpressions.slice(0, 2).join(" · ") || "구체적인 변화"}`,
      cta: "대본 다듬기",
      href: "/script-coach"
    },
    {
      title: "최근 개선된 점",
      body: speedMessage,
      meta: `현재 WPM ${latest.wpm} · clarity ${latest.clarityScore}`,
      cta: "연습 녹음하기",
      href: "/record?mode=prep"
    }
  ];

  return (
    <section className="grid gap-3 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.title} className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-normal text-marine">{card.title}</p>
          <h3 className="mt-3 min-h-16 text-lg font-black leading-7 text-ink">{card.body}</h3>
          <p className="mt-3 min-h-10 text-xs font-bold leading-5 text-slate-500">{card.meta}</p>
          <Link href={card.href} className="mt-5 inline-flex h-10 items-center rounded-lg border border-line bg-slate-50 px-4 text-xs font-black text-slate-300 hover:border-teal-300/40 hover:text-white">
            {card.cta}
          </Link>
        </article>
      ))}
    </section>
  );
}

function providerLabel(source: NonNullable<SpeechReport["sentenceFeedback"]>[number]["source"]) {
  if (source === "gemini") return "AI 표현 추천 (Gemini)";
  if (source === "openai") return "AI 표현 추천 (OpenAI)";
  return "기본 표현 추천";
}
