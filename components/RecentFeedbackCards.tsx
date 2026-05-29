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
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">녹음이 쌓이면 말습관, 어휘, 전달력 피드백이 이곳에 자동으로 정리됩니다.</p>
        <Link href="/record" className="mt-5 inline-flex h-11 items-center rounded-lg bg-teal-300 px-5 text-sm font-black text-slate-950">
          녹음 시작하기
        </Link>
      </section>
    );
  }

  const topFiller = Object.entries(latest.fillerCounts).sort((a, b) => b[1] - a[1])[0];
  const lexical = latest.lexicalReport;
  const genericWords = lexical?.repeatedGenericWords.slice(0, 3).map((item) => item.expression).join("/");
  const topCause = latest.causeCandidates[0];
  const expressionProvider = latest.sentenceFeedback?.[0]?.source;
  const speedMessage = latest.wpm > 135 ? "말 속도가 평균보다 빠르게 측정되었습니다." : latest.wpm < 85 ? "말 속도가 느리게 측정되어 핵심 전달이 늘어질 수 있습니다." : "말 속도는 비교적 안정적입니다.";

  const cards = [
    {
      title: "최근 원인 후보",
      body: topCause ? `${topCause.label} ${topCause.probability}%` : "특정 원인이 강하게 나타나지는 않았습니다.",
      meta: topCause?.evidence[0] ?? "개선 포인트 중심으로 확인하세요.",
      cta: "원인 점수 보기",
      href: `/report/${latest.id}`
    },
    {
      title: "최근 반복 표현",
      body: topFiller && topFiller[1] > 0 ? `이번 녹음에서 '${topFiller[0]}'이 ${topFiller[1]}회 반복되었습니다.` : "두드러진 채움말 반복은 적었습니다.",
      meta: "채움말을 1초 침묵으로 바꾸는 연습",
      cta: "대체 표현 보기",
      href: "/training"
    },
    {
      title: "어휘 추천",
      body: genericWords ? `${genericWords} 같은 범용 표현이 반복되었습니다.` : lexical?.summary ?? "표현 다양성 데이터가 준비 중입니다.",
      meta: `${providerLabel(expressionProvider)} · ${lexical?.recommendedExpressions.slice(0, 2).join(" · ") || "구체적인 변화"}`,
      cta: "표현력 훈련하기",
      href: "/training"
    },
    {
      title: "최근 개선된 점",
      body: speedMessage,
      meta: `현재 WPM ${latest.wpm} · clarity ${latest.clarityScore}`,
      cta: "속도 훈련 시작",
      href: "/training"
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
