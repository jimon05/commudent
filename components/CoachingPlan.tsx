import { getTrainingLabel } from "@/services/coachingService";
import type { SpeechReport } from "@/types/speech";

export function CoachingPlan({ report }: { report: SpeechReport }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-ink">맞춤 훈련</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {report.coachingPlan.recommendedTraining.map((training) => (
          <div key={training} className="rounded-lg border border-teal-100 bg-teal-50 p-4">
            <p className="text-sm font-black text-marine">{getTrainingLabel(training)}</p>
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {report.coachingPlan.actionItems.map((item) => (
          <li key={item} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-lg bg-slate-950 p-4 text-white">
        <p className="text-xs font-black uppercase tracking-normal text-teal-200">Next practice</p>
        <p className="mt-2 text-sm font-semibold leading-6">{report.coachingPlan.nextPracticePrompt}</p>
      </div>
    </section>
  );
}
