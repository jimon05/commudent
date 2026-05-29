"use client";

import { enrollVoiceProfileMock } from "@/services/speakerService";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { uploadAudioBlob } from "@/services/storageService";
import type { CauseScores, MainPainPoint, OnboardingSelfCheck, PrimaryGoal, UserProfile, VoiceProfile } from "@/types/speech";

const profileKey = "speech-coach-user-profile";
const voiceKey = "speech-coach-voice-profile";
const selfCheckKey = "speech-coach-self-check";

export const painPointLabels: Record<MainPainPoint, string> = {
  fast_speech: "말이 빨라짐",
  many_fillers: "음/어/약간을 많이 씀",
  disorganized: "말이 두서없음",
  blank_mind: "긴장하면 머리가 하얘짐",
  weak_delivery: "발음/전달력이 약함",
  too_long: "말을 너무 길게 함"
};

export const goalLabels: Record<PrimaryGoal, string> = {
  presentation: "발표",
  interview: "면접",
  meeting: "회의",
  daily: "일상 대화",
  class_discussion: "수업 토론",
  other: "기타"
};

function canUseStorage() {
  return typeof window !== "undefined" && window.localStorage;
}

export function getUserProfile(): UserProfile | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(profileKey);
  return raw ? (JSON.parse(raw) as UserProfile) : null;
}

export function getVoiceProfile(): VoiceProfile | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(voiceKey);
  return raw ? (JSON.parse(raw) as VoiceProfile) : null;
}

export function getOnboardingSelfCheck(): OnboardingSelfCheck | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(selfCheckKey);
  return raw ? (JSON.parse(raw) as OnboardingSelfCheck) : null;
}

export async function hydrateProfileFromSupabase() {
  if (!isSupabaseConfigured) {
    return {
      profile: getUserProfile(),
      voiceProfile: getVoiceProfile(),
      selfCheck: getOnboardingSelfCheck()
    };
  }

  const supabase = await createSupabaseBrowserClient();
  const userId = await getAuthenticatedUserId();
  if (!supabase || !userId) {
    return {
      profile: getUserProfile(),
      voiceProfile: getVoiceProfile(),
      selfCheck: getOnboardingSelfCheck()
    };
  }

  const { data: profileRow } = await supabase.from("user_profiles").select("*").eq("user_id", userId).single<Record<string, unknown>>();
  const { data: voiceRow } = await supabase.from("voice_profiles").select("*").eq("user_id", userId).single<Record<string, unknown>>();
  const { data: selfCheckRows } = await supabase.from("onboarding_self_checks").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);

  const profile = profileRow ? hydrateUserProfile(profileRow) : getUserProfile();
  const voiceProfile = voiceRow ? hydrateVoiceProfile(voiceRow) : getVoiceProfile();
  const firstSelfCheck = Array.isArray(selfCheckRows) ? selfCheckRows[0] as Record<string, unknown> | undefined : undefined;
  const selfCheck = firstSelfCheck ? hydrateSelfCheck(firstSelfCheck) : getOnboardingSelfCheck();

  if (canUseStorage()) {
    if (profile) window.localStorage.setItem(profileKey, JSON.stringify(profile));
    if (voiceProfile) window.localStorage.setItem(voiceKey, JSON.stringify(voiceProfile));
    if (selfCheck) window.localStorage.setItem(selfCheckKey, JSON.stringify(selfCheck));
  }

  return { profile, voiceProfile, selfCheck };
}

export async function saveOnboarding(input: {
  nickname: string;
  primaryGoal: PrimaryGoal;
  mainPainPoints: MainPainPoint[];
  voiceSampleUrl: string | null;
  voiceSampleBlob?: Blob | null;
  voiceDurationSeconds: number;
  selfCheckAnswers: Record<string, string | number | boolean>;
}) {
  const userId = (await getAuthenticatedUserId()) ?? "local-demo-user";
  const uploadedVoice = input.voiceSampleBlob && userId !== "local-demo-user"
    ? await uploadAudioBlob({ blob: input.voiceSampleBlob, userId, folder: "voice-profiles" }).catch(() => null)
    : null;
  const sampleAudioUrl = uploadedVoice?.url ?? input.voiceSampleUrl;
  const profile: UserProfile = {
    id: `profile-${Date.now()}`,
    userId,
    nickname: input.nickname || "발표 연습자",
    primaryGoal: input.primaryGoal,
    mainPainPoints: input.mainPainPoints,
    createdAt: new Date().toISOString()
  };

  const enrollment = await enrollVoiceProfileMock({
    userId,
    audioUrl: sampleAudioUrl,
    durationSeconds: input.voiceDurationSeconds
  });

  const voiceProfile: VoiceProfile = {
    id: `voice-${Date.now()}`,
    userId,
    sampleAudioUrl,
    sampleStoragePath: uploadedVoice?.storagePath ?? null,
    voiceEmbeddingId: enrollment.voiceEmbeddingId,
    enrollmentStatus: uploadedVoice ? "sample_saved" : enrollment.enrollmentStatus,
    createdAt: new Date().toISOString()
  };

  const initialTypeScores = buildInitialScores(input.mainPainPoints, input.selfCheckAnswers);
  const selfCheck: OnboardingSelfCheck = {
    id: `self-check-${Date.now()}`,
    userId,
    answers: input.selfCheckAnswers,
    initialTypeScores,
    createdAt: new Date().toISOString()
  };

  window.localStorage.setItem(profileKey, JSON.stringify(profile));
  window.localStorage.setItem(voiceKey, JSON.stringify(voiceProfile));
  window.localStorage.setItem(selfCheckKey, JSON.stringify(selfCheck));

  await saveOnboardingToSupabase({ profile, voiceProfile, selfCheck }).catch((error) => {
    console.warn("Supabase onboarding save failed. Local fallback was kept.", error);
  });

  return { profile, voiceProfile, selfCheck };
}

async function getAuthenticatedUserId() {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseBrowserClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  return data.user?.id ?? null;
}

async function saveOnboardingToSupabase(input: {
  profile: UserProfile;
  voiceProfile: VoiceProfile;
  selfCheck: OnboardingSelfCheck;
}) {
  if (!isSupabaseConfigured || input.profile.userId === "local-demo-user") return;
  const supabase = await createSupabaseBrowserClient();
  if (!supabase) return;

  await supabase.from("user_profiles").upsert({
    user_id: input.profile.userId,
    nickname: input.profile.nickname,
    primary_goal: input.profile.primaryGoal,
    main_pain_points: input.profile.mainPainPoints
  }, { onConflict: "user_id" });

  await supabase.from("voice_profiles").upsert({
    user_id: input.voiceProfile.userId,
    sample_audio_url: input.voiceProfile.sampleAudioUrl,
    sample_storage_path: input.voiceProfile.sampleStoragePath,
    voice_embedding_id: input.voiceProfile.voiceEmbeddingId,
    enrollment_status: input.voiceProfile.enrollmentStatus
  }, { onConflict: "user_id" });

  await supabase.from("onboarding_self_checks").insert({
    user_id: input.selfCheck.userId,
    answers: input.selfCheck.answers,
    initial_type_scores: input.selfCheck.initialTypeScores
  });
}

function buildInitialScores(mainPainPoints: MainPainPoint[], answers: Record<string, string | number | boolean>): CauseScores {
  const text = Object.values(answers).join(" ");
  return {
    anxiety_pressure: clamp((mainPainPoints.includes("blank_mind") ? 0.46 : 0.16) + (text.includes("긴장") || text.includes("하얘") ? 0.18 : 0)),
    cognitive_load: clamp((text.includes("정리") || text.includes("단어") ? 0.44 : 0.16) + (mainPainPoints.includes("blank_mind") ? 0.12 : 0)),
    discourse_structure: clamp((mainPainPoints.includes("disorganized") || mainPainPoints.includes("too_long") ? 0.46 : 0.16) + (text.includes("결론") || text.includes("두서") ? 0.18 : 0)),
    habitual_pattern: clamp((mainPainPoints.includes("many_fillers") ? 0.46 : 0.16) + (text.includes("반복") || text.includes("음/어") ? 0.18 : 0)),
    delivery_regulation: clamp((mainPainPoints.includes("fast_speech") || mainPainPoints.includes("weak_delivery") ? 0.46 : 0.16) + (text.includes("빠르") || text.includes("전달") ? 0.18 : 0))
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function hydrateUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    nickname: String(row.nickname ?? "발표 연습자"),
    primaryGoal: String(row.primary_goal ?? "presentation") as PrimaryGoal,
    mainPainPoints: Array.isArray(row.main_pain_points) ? row.main_pain_points as MainPainPoint[] : [],
    createdAt: String(row.created_at ?? new Date().toISOString())
  };
}

function hydrateVoiceProfile(row: Record<string, unknown>): VoiceProfile {
  const enrollmentStatus = String(row.enrollment_status ?? "pending") as VoiceProfile["enrollmentStatus"];
  return {
    id: String(row.id),
    userId: String(row.user_id),
    sampleAudioUrl: typeof row.sample_audio_url === "string" ? row.sample_audio_url : null,
    sampleStoragePath: typeof row.sample_storage_path === "string" ? row.sample_storage_path : null,
    voiceEmbeddingId: String(row.voice_embedding_id ?? ""),
    enrollmentStatus,
    createdAt: String(row.created_at ?? new Date().toISOString())
  };
}

function hydrateSelfCheck(row: Record<string, unknown>): OnboardingSelfCheck {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    answers: (row.answers ?? {}) as OnboardingSelfCheck["answers"],
    initialTypeScores: (row.initial_type_scores ?? {}) as CauseScores,
    createdAt: String(row.created_at ?? new Date().toISOString())
  };
}
