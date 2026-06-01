import { mockReport } from "@/lib/mockData";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { getOnboardingSelfCheck, getVoiceProfile } from "@/services/profileService";
import { analyzePresentationDelivery, extractKeyMessages } from "@/services/presentationAnalysisService";
import { analyzeSpeech } from "@/services/speechAnalysisService";
import { filterUserSpeech, splitSpeakersMock } from "@/services/speakerService";
import { transcribeAudio } from "@/services/sttService";
import { deleteAudioPath, uploadAudioBlob } from "@/services/storageService";
import { trainingRowsForStorage } from "@/services/trainingRecommendationService";
import type { LexicalReport, RecordingDraft, SpeechReport } from "@/types/speech";

const storageKey = "speech-coach-reports";

export { extractKeyMessages };

function canUseStorage() {
  return typeof window !== "undefined" && window.localStorage;
}

export function readLocalReports(): SpeechReport[] {
  if (!canUseStorage()) return [];
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SpeechReport[];
  } catch {
    return [];
  }
}

function writeLocalReports(reports: SpeechReport[]) {
  if (canUseStorage()) window.localStorage.setItem(storageKey, JSON.stringify(reports));
}

export async function createMockReport(draft: RecordingDraft): Promise<SpeechReport> {
  return createSpeechReport(draft);
}

export async function createSpeechReport(draft: RecordingDraft): Promise<SpeechReport> {
  const recordingId = `report-${Date.now()}`;
  const audioFile = draft.audioBlob ? await uploadRecordingAudio(draft.audioBlob) : { url: draft.audioUrl ?? null, storagePath: null };
  const stt = await transcribeAudio({ audioBlob: draft.audioBlob, durationSeconds: draft.durationSeconds });
  const transcript = stt.transcript;
  const voiceProfile = getVoiceProfile();
  const selfCheck = getOnboardingSelfCheck();
  const segments = await splitSpeakersMock({
    recordingId,
    transcript,
    userSpeakerId: voiceProfile?.voiceEmbeddingId
  });
  const userTranscript = voiceProfile ? filterUserSpeech(segments) : transcript;
  const base = await analyzeSpeech({
    recordingId,
    title: draft.title || "새 발표 연습",
    contextType: draft.postSpeechSelfCheck?.contextType ?? draft.contextType,
    transcript: userTranscript,
    durationSeconds: draft.durationSeconds,
    survey: draft.survey,
    postSpeechSelfCheck: draft.postSpeechSelfCheck,
    onboardingSelfCheck: selfCheck?.answers,
    hasUserVoiceProfile: Boolean(voiceProfile),
    priorReports: readLocalReports()
  });
  const slideTranscriptText = draft.slideTranscripts?.map((item) => `Slide ${item.slideIndex} ${item.slideTitle}: ${item.transcript}`).join("\n").trim();
  const analysisTranscript = slideTranscriptText || transcript;
  const messageDelivery = analyzePresentationDelivery({
    script: draft.script,
    slides: draft.slides,
    transcript: analysisTranscript,
    extractedKeyMessages: draft.extractedKeyMessages,
    fallbackSummary: base.feedbackSummary,
    deliveryScore: base.deliveryScore
  });
  const report: SpeechReport = {
    ...base,
    script: draft.script,
    slides: draft.slides,
    timeLimit: draft.timeLimit,
    emphasisPoints: draft.emphasisPoints,
    prepCautions: draft.prepCautions,
    slideTranscripts: draft.slideTranscripts,
    ...messageDelivery,
    audioUrl: audioFile.url,
    audioStoragePath: audioFile.storagePath,
    sttProvider: stt.provider,
    analysisMode: stt.provider === "openai" ? "live" : "development_fallback",
    feedbackSummary: stt.warning ? `${messageDelivery.feedbackSummary} ${stt.warning}` : messageDelivery.feedbackSummary
  };
  await saveReportToSupabase(report, draft, audioFile.url, audioFile.storagePath, segments).catch((error) => {
    console.warn("Supabase report save failed. Local fallback was kept.", error);
  });
  writeLocalReports([report, ...readLocalReports().filter((item) => item.id !== report.id)].slice(0, 8));
  return report;
}

export async function getReportById(id: string): Promise<SpeechReport | null> {
  if (typeof window === "undefined") return id === mockReport.id ? mockReport : mockReport;
  const supabaseReport = await getReportFromSupabase(id).catch(() => null);
  if (supabaseReport) return supabaseReport;
  return readLocalReports().find((report) => report.id === id) ?? mockReport;
}

export async function listRecentReports(): Promise<SpeechReport[]> {
  if (typeof window === "undefined") return [];
  const supabaseReports = await listReportsFromSupabase().catch(() => []);
  if (supabaseReports.length > 0) return supabaseReports;
  const localReports = readLocalReports();
  return localReports.length > 0 ? localReports : [mockReport];
}

export async function deleteReport(id: string) {
  if (typeof window !== "undefined") {
    writeLocalReports(readLocalReports().filter((report) => report.id !== id && report.recordingId !== id));
  }
  if (!isSupabaseConfigured) return;
  const supabase = await createSupabaseBrowserClient();
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;
  const { data: recording } = await supabase.from("recordings").select("audio_storage_path").eq("id", id).eq("user_id", userId).single<{ audio_storage_path?: string | null }>();
  if (recording?.audio_storage_path) {
    await deleteAudioPath(recording.audio_storage_path).catch((error) => {
      console.warn("Storage audio delete failed. DB record deletion will continue.", error);
    });
  }
  await supabase.from("recordings").delete().eq("id", id).eq("user_id", userId);
}

export function getDashboardOverview(reports: SpeechReport[]) {
  const latest = reports[0] ?? mockReport;
  return {
    totalRecordings: reports.length,
    averageWpm: Math.round(reports.reduce((sum, report) => sum + report.wpm, 0) / Math.max(reports.length, 1)),
    fillerTrend: latest.weeklyTrend.fillerChangePercent,
    clarityScore: latest.clarityScore,
    structureScore: latest.structureScore,
    deliveryScore: latest.deliveryScore
  };
}

async function uploadRecordingAudio(blob: Blob) {
  const userId = await getCurrentUserId();
  if (!userId) return { url: URL.createObjectURL(blob), storagePath: null };
  return uploadAudioBlob({ blob, userId, folder: "recordings" });
}

async function getCurrentUserId() {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseBrowserClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  return data.user?.id ?? null;
}

async function saveReportToSupabase(report: SpeechReport, draft: RecordingDraft, audioUrl: string | null, audioStoragePath: string | null | undefined, segments: Awaited<ReturnType<typeof splitSpeakersMock>>) {
  if (!isSupabaseConfigured) return;
  const supabase = await createSupabaseBrowserClient();
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  const { data: recording, error: recordingError } = await supabase
    .from("recordings")
    .insert({
      user_id: userId,
      title: report.title,
      context_type: report.contextType,
      audio_url: audioUrl,
      audio_storage_path: audioStoragePath,
      transcript: report.transcript,
      duration_seconds: draft.durationSeconds
    })
    .select("id")
    .single<{ id: string }>();

  if (recordingError) throw recordingError;
  if (!recording) throw new Error("녹음 레코드 저장 결과를 받지 못했습니다.");
  const recordingId = recording.id;
  report.id = recordingId;
  report.recordingId = recordingId;

  await supabase.from("pre_speech_surveys").insert({
    recording_id: recordingId,
    nervousness_score: draft.survey.nervousnessScore,
    preparedness_score: draft.survey.preparednessScore,
    confidence_score: draft.survey.confidenceScore,
    condition_score: draft.survey.conditionScore
  });

  if (report.postSpeechSelfCheck) {
    await supabase.from("post_speech_feedback").insert({
      recording_id: recordingId,
      context_type: report.postSpeechSelfCheck.contextType,
      nervousness_score: report.postSpeechSelfCheck.nervousnessScore,
      perceived_difficulty: report.postSpeechSelfCheck.perceivedDifficulty,
      user_note: report.postSpeechSelfCheck.userNote ?? ""
    });
  }

  await supabase.from("speech_reports").insert({
    recording_id: recordingId,
    filler_counts: report.fillerCounts,
    pause_data: report.pauseData,
    repeated_expressions: report.repeatedExpressions,
    average_sentence_length: report.averageSentenceLength,
    wpm: report.wpm,
    clarity_score: report.clarityScore,
    structure_score: report.structureScore,
    delivery_score: report.deliveryScore,
    cause_candidates: report.causeCandidates,
    long_sentences: report.longSentences,
    self_corrections: report.selfCorrections,
    structure_data: report.structure,
    improved_version: report.improvedVersion,
    feedback_summary: report.feedbackSummary,
    stt_provider: report.sttProvider,
    analysis_mode: report.analysisMode
  });

  if (report.featureReport) {
    await supabase.from("feature_reports").insert({
      recording_id: recordingId,
      fluency_features: report.featureReport.fluencyFeatures,
      delivery_features: report.featureReport.deliveryFeatures,
      structure_features: report.featureReport.structureFeatures,
      lexical_features: report.featureReport.lexicalFeatures,
      context_features: report.featureReport.contextFeatures,
      normalized_features: report.featureReport.normalizedFeatures
    });
  }

  if (report.sentenceFeedback?.length) {
    await supabase.from("expression_suggestions").insert(
      report.sentenceFeedback.map((item) => ({
        recording_id: recordingId,
        original: item.original,
        detected_issue: item.detected_issue,
        improved_version: item.improved_version,
        explanation: item.explanation,
        tone: item.tone,
        source: item.source ?? "fallback"
      }))
    );
  }

  if (report.lexicalReport) {
    try {
      await supabase.from("lexical_reports").insert({
        recording_id: recordingId,
        lexical_diversity_score: report.lexicalReport.lexicalDiversityScore,
        repeated_generic_words: report.lexicalReport.repeatedGenericWords,
        recommended_expressions: report.lexicalReport.recommendedExpressions,
        summary: report.lexicalReport.summary
      });
    } catch (error) {
      console.warn("Lexical report save failed. Dashboard will compute a fallback.", error);
    }
  }

  await supabase.from("cause_scores").insert({
    recording_id: recordingId,
    anxiety_pressure_score: report.causeScores.anxiety_pressure,
    cognitive_load_score: report.causeScores.cognitive_load,
    discourse_structure_score: report.causeScores.discourse_structure,
    habitual_pattern_score: report.causeScores.habitual_pattern,
    delivery_regulation_score: report.causeScores.delivery_regulation,
    top_causes: report.causeCandidates,
    score_explanations: Object.fromEntries(report.causeCandidates.map((candidate) => [candidate.type, candidate.evidence])),
    inference_model_version: "weighted-feature-v2"
  });

  await supabase.from("coaching_plans").insert({
    recording_id: recordingId,
    recommended_training: report.coachingPlan.recommendedTraining,
    action_items: report.coachingPlan.actionItems,
    next_practice_prompt: report.coachingPlan.nextPracticePrompt
  });

  const trainingRows = trainingRowsForStorage(report.causeCandidates);
  if (trainingRows.length > 0) {
    await supabase.from("training_recommendations").insert(
      trainingRows.map((row) => ({
        recording_id: recordingId,
        target_cause: row.targetCause,
        recommended_training: row.recommendedTraining,
        reason: row.reason
      }))
    );
  }

  await supabase.from("speaker_segments").insert(
    segments.map((segment) => ({
      recording_id: recordingId,
      speaker_label: segment.speakerLabel,
      is_user_voice: segment.isUserVoice,
      start_time: segment.startTime,
      end_time: segment.endTime,
      transcript: segment.transcript,
      confidence: segment.confidence
    }))
  );
}

async function getReportFromSupabase(recordingId: string): Promise<SpeechReport | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseBrowserClient();
  if (!supabase) return null;

  const { data: recording } = await supabase.from("recordings").select("*").eq("id", recordingId).single<Record<string, unknown>>();
  if (!recording) return null;
  const { data: report } = await supabase.from("speech_reports").select("*").eq("recording_id", recordingId).single<Record<string, unknown>>();
  const { data: scores } = await supabase.from("cause_scores").select("*").eq("recording_id", recordingId).single<Record<string, unknown>>();
  const { data: plan } = await supabase.from("coaching_plans").select("*").eq("recording_id", recordingId).single<Record<string, unknown>>();
  const { data: lexical } = await supabase.from("lexical_reports").select("*").eq("recording_id", recordingId).single<Record<string, unknown>>();
  const { data: feature } = await supabase.from("feature_reports").select("*").eq("recording_id", recordingId).single<Record<string, unknown>>();
  const { data: postCheck } = await supabase.from("post_speech_feedback").select("*").eq("recording_id", recordingId).single<Record<string, unknown>>();
  const { data: suggestions } = await supabase.from("expression_suggestions").select("*").eq("recording_id", recordingId).order("created_at", { ascending: true });

  if (!report || !scores) return null;
  return hydrateReport(recording, report, scores, plan, lexical, feature, postCheck, Array.isArray(suggestions) ? suggestions as Array<Record<string, unknown>> : []);
}

async function listReportsFromSupabase(): Promise<SpeechReport[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseBrowserClient();
  if (!supabase) return [];
  const { data } = await supabase.from("recordings").select("*").order("created_at", { ascending: false }).limit(8);
  const recordings = Array.isArray(data) ? (data as Array<{ id: string }>) : [];
  if (!recordings.length) return [];
  const reports = await Promise.all(recordings.map((recording) => getReportFromSupabase(recording.id)));
  return reports.filter(Boolean) as SpeechReport[];
}

function hydrateReport(
  recording: Record<string, unknown>,
  report: Record<string, unknown>,
  scores: Record<string, unknown>,
  plan: Record<string, unknown> | null,
  lexical: Record<string, unknown> | null,
  feature: Record<string, unknown> | null,
  postCheck: Record<string, unknown> | null,
  suggestions: Array<Record<string, unknown>>
): SpeechReport {
  const contextType = typeof recording.context_type === "string" ? recording.context_type : "presentation";
  const recordingId = String(recording.id);
  const transcript = String(recording.transcript ?? "");
  return {
    id: recordingId,
    recordingId,
    title: String(recording.title ?? "저장된 녹음"),
    contextType: contextType as SpeechReport["contextType"],
    transcript,
    durationSeconds: Number(recording.duration_seconds ?? 0),
    createdAt: String(recording.created_at ?? new Date().toISOString()),
    audioUrl: typeof recording.audio_url === "string" ? recording.audio_url : null,
    audioStoragePath: typeof recording.audio_storage_path === "string" ? recording.audio_storage_path : null,
    sttProvider: typeof report.stt_provider === "string" && report.stt_provider === "openai" ? "openai" : "mock",
    analysisMode: typeof report.analysis_mode === "string" && report.analysis_mode === "live" ? "live" : "development_fallback",
    featureReport: feature
      ? {
          fluencyFeatures: (feature.fluency_features ?? {}) as NonNullable<SpeechReport["featureReport"]>["fluencyFeatures"],
          deliveryFeatures: (feature.delivery_features ?? {}) as NonNullable<SpeechReport["featureReport"]>["deliveryFeatures"],
          structureFeatures: (feature.structure_features ?? {}) as NonNullable<SpeechReport["featureReport"]>["structureFeatures"],
          lexicalFeatures: (feature.lexical_features ?? {}) as NonNullable<SpeechReport["featureReport"]>["lexicalFeatures"],
          contextFeatures: (feature.context_features ?? {}) as NonNullable<SpeechReport["featureReport"]>["contextFeatures"],
          normalizedFeatures: (feature.normalized_features ?? {}) as NonNullable<SpeechReport["featureReport"]>["normalizedFeatures"]
        }
      : undefined,
    postSpeechSelfCheck: postCheck
      ? {
          contextType: String(postCheck.context_type ?? contextType) as SpeechReport["contextType"],
          nervousnessScore: Number(postCheck.nervousness_score ?? 3),
          perceivedDifficulty: String(postCheck.perceived_difficulty ?? "특별한 어려움은 없었다") as NonNullable<SpeechReport["postSpeechSelfCheck"]>["perceivedDifficulty"],
          userNote: String(postCheck.user_note ?? "")
      }
      : undefined,
    sentenceFeedback: suggestions.map((item) => ({
      original: String(item.original ?? ""),
      detected_issue: String(item.detected_issue ?? ""),
      improved_version: String(item.improved_version ?? ""),
      explanation: String(item.explanation ?? ""),
      tone: String(item.tone ?? "presentation") as NonNullable<SpeechReport["sentenceFeedback"]>[number]["tone"],
      source: String(item.source ?? "fallback") as NonNullable<SpeechReport["sentenceFeedback"]>[number]["source"]
    })),
    lexicalReport: lexical ? hydrateLexicalReport(recordingId, lexical) : buildLexicalReport(recordingId, transcript),
    fillerCounts: (report.filler_counts ?? {}) as SpeechReport["fillerCounts"],
    pauseData: (report.pause_data ?? { count: 0, averageLengthSeconds: 0, points: [] }) as SpeechReport["pauseData"],
    repeatedExpressions: (report.repeated_expressions ?? []) as SpeechReport["repeatedExpressions"],
    averageSentenceLength: Number(report.average_sentence_length ?? 0),
    longSentences: (report.long_sentences ?? []) as SpeechReport["longSentences"],
    wpm: Number(report.wpm ?? 0),
    selfCorrections: (report.self_corrections ?? []) as SpeechReport["selfCorrections"],
    structure: (report.structure_data ?? { intro: "", body: "", conclusion: "", keyMessagePosition: "unclear" }) as SpeechReport["structure"],
    clarityScore: Number(report.clarity_score ?? 0),
    structureScore: Number(report.structure_score ?? 0),
    ...analyzePresentationDelivery({
      transcript,
      fallbackSummary: String(report.feedback_summary ?? ""),
      deliveryScore: Number(report.delivery_score ?? 0)
    }),
    causeScores: {
      anxiety_pressure: Number(scores.anxiety_pressure_score ?? 0),
      cognitive_load: Number(scores.cognitive_load_score ?? 0),
      discourse_structure: Number(scores.discourse_structure_score ?? 0),
      habitual_pattern: Number(scores.habitual_pattern_score ?? 0),
      delivery_regulation: Number(scores.delivery_regulation_score ?? 0)
    },
    causeCandidates: (scores.top_causes ?? report.cause_candidates ?? []) as SpeechReport["causeCandidates"],
    coachingPlan: {
      recommendedTraining: (plan?.recommended_training ?? []) as SpeechReport["coachingPlan"]["recommendedTraining"],
      actionItems: (plan?.action_items ?? []) as SpeechReport["coachingPlan"]["actionItems"],
      nextPracticePrompt: String(plan?.next_practice_prompt ?? "")
    },
    improvedVersion: String(report.improved_version ?? ""),
    weeklyTrend: {
      averageWpm: Number(report.wpm ?? 0),
      fillerChangePercent: 0,
      pauseChangePercent: 0,
      structureScore: Number(report.structure_score ?? 0),
      clarityScore: Number(report.clarity_score ?? 0),
      patternSummary: "Supabase에 저장된 실제 리포트를 불러왔습니다."
    }
  };
}

export function buildLexicalReport(recordingId: string, transcript: string): LexicalReport {
  const genericWords = ["좋다", "좋은", "많다", "많은", "느낌", "약간", "뭔가", "사실", "이제", "되게", "정말"];
  const tokens = transcript
    .replace(/[.,!?。？！]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const uniqueCount = new Set(tokens).size;
  const repeatedGenericWords = genericWords
    .map((word) => ({ expression: word, count: countText(transcript, word) }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const repetitionPenalty = repeatedGenericWords.reduce((sum, item) => sum + item.count, 0) * 3;
  const lexicalDiversityScore = Math.max(42, Math.min(96, Math.round((uniqueCount / Math.max(tokens.length, 1)) * 100 + 38 - repetitionPenalty)));

  return {
    recordingId,
    lexicalDiversityScore,
    repeatedGenericWords,
    recommendedExpressions: ["뚜렷한 개선", "높은 관심", "긍정적인 반응", "구체적인 변화", "핵심적인 차이"],
    summary: repeatedGenericWords.length > 0 ? "범용 표현이 반복되어 더 구체적인 표현으로 바꿔볼 수 있습니다." : "반복되는 범용 표현이 크게 두드러지지 않았습니다.",
    createdAt: new Date().toISOString()
  };
}

function hydrateLexicalReport(recordingId: string, row: Record<string, unknown>): LexicalReport {
  return {
    id: String(row.id),
    recordingId,
    lexicalDiversityScore: Number(row.lexical_diversity_score ?? 0),
    repeatedGenericWords: (row.repeated_generic_words ?? []) as LexicalReport["repeatedGenericWords"],
    recommendedExpressions: (row.recommended_expressions ?? []) as string[],
    summary: String(row.summary ?? ""),
    createdAt: String(row.created_at ?? new Date().toISOString())
  };
}

function countText(text: string, needle: string) {
  return text.match(new RegExp(needle, "g"))?.length ?? 0;
}
