"use client";

import type { FeatureReport } from "@/types/speech";

const methodBadges: Record<string, string> = {
  pause_score: "추정",
  pause_lack_score: "추정",
  prep_failure_score: "규칙 기반",
  prep_score: "규칙 기반",
  topic_drift_score: "규칙 기반",
  structure_problem_score: "부분 추정",
  discourse_coherence_score: "규칙 기반",
  emphasis_problem_score: "미측정"
};

const methodNotes: Record<string, string> = {
  pause_score: "transcript의 pause 표기와 녹음 길이 기반 추정값입니다.",
  pause_lack_score: "실제 silence detection이 아니라 transcript 기반 pause 추정값입니다.",
  prep_failure_score: "PREP marker 존재 여부로 계산한 규칙 기반 구조 분석입니다.",
  prep_score: "PREP marker 존재 여부로 계산한 규칙 기반 구조 분석입니다.",
  topic_drift_score: "문장 간 토큰 overlap 기반 규칙 분석입니다.",
  discourse_coherence_score: "topic drift의 역방향 규칙 기반 점수입니다.",
  structure_problem_score: "PREP, 핵심 메시지 위치, topic drift를 조합한 추정 점수입니다.",
  emphasis_problem_score: "pitch/intensity 분석이 없어 현재 0으로 고정됩니다."
};

export function FeatureBreakdownPanel({ featureReport }: { featureReport?: FeatureReport }) {
  if (!featureReport) return null;

  const groups = [
    {
      title: "발화 유창성",
      rows: {
        filler_ratio: featureReport.fluencyFeatures.fillerRatio,
        filler_score: featureReport.fluencyFeatures.fillerScore,
        pause_score: featureReport.fluencyFeatures.pauseScore,
        self_repair_score: featureReport.fluencyFeatures.selfRepairScore,
        hesitation_score: featureReport.fluencyFeatures.hesitationScore,
        early_filler_score: featureReport.fluencyFeatures.earlyFillerScore
      }
    },
    {
      title: "전달 특성",
      rows: {
        eojeol_per_minute: featureReport.deliveryFeatures.eojeolPerMinute,
        delivery_speed_score: featureReport.deliveryFeatures.deliverySpeedScore,
        wpm_variability_score: featureReport.deliveryFeatures.wpmVariabilityScore,
        sentence_length_score: featureReport.deliveryFeatures.sentenceLengthScore,
        clarity_problem_score: featureReport.deliveryFeatures.clarityProblemScore,
        pause_lack_score: featureReport.deliveryFeatures.pauseLackScore,
        emphasis_problem_score: featureReport.normalizedFeatures.emphasis_problem_score
      }
    },
    {
      title: "구조화",
      rows: {
        prep_score: featureReport.structureFeatures.prepScore,
        prep_failure_score: featureReport.structureFeatures.prepFailureScore,
        key_message_position: featureReport.structureFeatures.keyMessagePosition,
        key_message_delay_score: featureReport.structureFeatures.keyMessageDelayScore,
        topic_drift_score: featureReport.structureFeatures.topicDriftScore,
        structure_problem_score: featureReport.structureFeatures.structureProblemScore,
        discourse_coherence_score: featureReport.structureFeatures.discourseCoherenceScore
      }
    },
    {
      title: "표현력",
      rows: {
        TTR: featureReport.lexicalFeatures.ttr,
        simplified_MTLD: featureReport.lexicalFeatures.simplifiedMtld,
        lexical_diversity_score: featureReport.lexicalFeatures.lexicalDiversityScore,
        vague_expression_score: featureReport.lexicalFeatures.vagueExpressionScore,
        repetition_score: featureReport.lexicalFeatures.repetitionScore,
        repeated_expression_count: featureReport.lexicalFeatures.repeatedExpressionCount,
        expression_precision_score: featureReport.lexicalFeatures.expressionPrecisionScore
      }
    },
    {
      title: "상황 정보",
      rows: {
        presentation_context_score: featureReport.contextFeatures.presentationContextScore,
        nervousness_score: featureReport.contextFeatures.nervousnessScore
      }
    }
  ];

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-ink">Feature breakdown</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">문제 점수는 0에 가까울수록 낮고, 1에 가까울수록 강하게 관찰된 상태입니다.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {groups.map((group) => (
          <article key={group.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-ink">{group.title}</h3>
            <div className="mt-3 space-y-2">
              {Object.entries(group.rows).map(([label, value]) => (
                <div key={label} className="rounded-md bg-white/70 px-2 py-2 text-xs font-bold text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{label}</span>
                      {methodBadges[label] ? (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">{methodBadges[label]}</span>
                      ) : null}
                    </span>
                    <span className="font-black text-marine">{format(value)}</span>
                  </div>
                  {methodNotes[label] ? <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-500">{methodNotes[label]}</p> : null}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function format(value: number) {
  if (value > 1) return String(Math.round(value));
  return value.toFixed(2);
}
