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

function localProfileForUser(userId: string) {
  const profile = getUserProfile();
  return profile?.userId === userId ? profile : null;
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

export async function getOnboardingStatus() {
  const { profile, voiceProfile, selfCheck } = await hydrateProfileFromSupabase();
  const onboardingCompleted = profile?.onboardingCompleted === true;
  return {
    profile,
    voiceProfile,
    selfCheck,
    onboardingCompleted,
    nextStep: onboardingCompleted ? 6 : resolveResumeStep({ profile, voiceProfile, selfCheck })
  };
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

  const localProfile = getUserProfile();
  const localVoiceProfile = getVoiceProfile();
  const localSelfCheck = getOnboardingSelfCheck();
  const profile = profileRow ? hydrateUserProfile(profileRow) : localProfile?.userId === userId ? localProfile : null;
  const voiceProfile = voiceRow ? hydrateVoiceProfile(voiceRow) : localVoiceProfile?.userId === userId ? localVoiceProfile : null;
  const firstSelfCheck = Array.isArray(selfCheckRows) ? selfCheckRows[0] as Record<string, unknown> | undefined : undefined;
  const selfCheck = firstSelfCheck ? hydrateSelfCheck(firstSelfCheck) : localSelfCheck?.userId === userId ? localSelfCheck : null;

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
    onboardingCompleted: true,
    onboardingCompletedAt: new Date().toISOString(),
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

export async function saveProfileSetup(input: { nickname: string }) {
  const userId = (await getAuthenticatedUserId()) ?? "local-demo-user";
  const existing = localProfileForUser(userId);
  const profile: UserProfile = {
    id: existing?.id ?? `profile-${Date.now()}`,
    userId,
    nickname: input.nickname || existing?.nickname || "나의 Commudent profile",
    primaryGoal: existing?.primaryGoal ?? "presentation",
    mainPainPoints: existing?.mainPainPoints ?? [],
    onboardingCompleted: existing?.onboardingCompleted ?? false,
    onboardingCompletedAt: existing?.onboardingCompletedAt ?? null,
    createdAt: existing?.createdAt ?? new Date().toISOString()
  };
  if (canUseStorage()) window.localStorage.setItem(profileKey, JSON.stringify(profile));
  await upsertProfileToSupabase(profile).catch((error) => {
    console.warn("Supabase profile setup save failed. Local fallback was kept.", error);
  });
  return profile;
}

export async function saveOnboardingQuestions(input: {
  nickname: string;
  primaryGoal: PrimaryGoal;
  mainPainPoints: MainPainPoint[];
  selfCheckAnswers: Record<string, string | number | boolean>;
}) {
  const userId = (await getAuthenticatedUserId()) ?? "local-demo-user";
  const existing = localProfileForUser(userId);
  const profile: UserProfile = {
    id: existing?.id ?? `profile-${Date.now()}`,
    userId,
    nickname: input.nickname || existing?.nickname || "나의 Commudent profile",
    primaryGoal: input.primaryGoal,
    mainPainPoints: input.mainPainPoints,
    onboardingCompleted: existing?.onboardingCompleted ?? false,
    onboardingCompletedAt: existing?.onboardingCompletedAt ?? null,
    createdAt: existing?.createdAt ?? new Date().toISOString()
  };
  const selfCheck: OnboardingSelfCheck = {
    id: `self-check-${Date.now()}`,
    userId,
    answers: input.selfCheckAnswers,
    initialTypeScores: buildInitialScores(input.mainPainPoints, input.selfCheckAnswers),
    createdAt: new Date().toISOString()
  };

  if (canUseStorage()) {
    window.localStorage.setItem(profileKey, JSON.stringify(profile));
    window.localStorage.setItem(selfCheckKey, JSON.stringify(selfCheck));
  }
  await saveQuestionStateToSupabase({ profile, selfCheck }).catch((error) => {
    console.warn("Supabase onboarding question save failed. Local fallback was kept.", error);
  });
  return { profile, selfCheck };
}

export async function saveVoiceProfileStep(input: {
  voiceSampleUrl: string | null;
  voiceSampleBlob?: Blob | null;
  voiceDurationSeconds: number;
}) {
  const userId = (await getAuthenticatedUserId()) ?? "local-demo-user";
  const uploadedVoice = input.voiceSampleBlob && userId !== "local-demo-user"
    ? await uploadAudioBlob({ blob: input.voiceSampleBlob, userId, folder: "voice-profiles" }).catch(() => null)
    : null;
  const sampleAudioUrl = uploadedVoice?.url ?? input.voiceSampleUrl;
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

  if (canUseStorage()) window.localStorage.setItem(voiceKey, JSON.stringify(voiceProfile));
  await upsertVoiceProfileToSupabase(voiceProfile).catch((error) => {
    console.warn("Supabase voice profile save failed. Local fallback was kept.", error);
  });
  return voiceProfile;
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

  await upsertProfileToSupabase(input.profile);
  await upsertVoiceProfileToSupabase(input.voiceProfile);

  await supabase.from("onboarding_self_checks").insert({
    user_id: input.selfCheck.userId,
    answers: input.selfCheck.answers,
    initial_type_scores: input.selfCheck.initialTypeScores
  });
}

async function saveQuestionStateToSupabase(input: {
  profile: UserProfile;
  selfCheck: OnboardingSelfCheck;
}) {
  if (!isSupabaseConfigured || input.profile.userId === "local-demo-user") return;
  await upsertProfileToSupabase(input.profile);
  const supabase = await createSupabaseBrowserClient();
  if (!supabase) return;
  await supabase.from("onboarding_self_checks").insert({
    user_id: input.selfCheck.userId,
    answers: input.selfCheck.answers,
    initial_type_scores: input.selfCheck.initialTypeScores
  });
}

async function upsertProfileToSupabase(profile: UserProfile) {
  if (!isSupabaseConfigured || profile.userId === "local-demo-user") return;
  const supabase = await createSupabaseBrowserClient();
  if (!supabase) return;
  await supabase.from("user_profiles").upsert({
    user_id: profile.userId,
    nickname: profile.nickname,
    primary_goal: profile.primaryGoal,
    main_pain_points: profile.mainPainPoints,
    onboarding_completed: profile.onboardingCompleted,
    onboarding_completed_at: profile.onboardingCompletedAt ?? null
  }, { onConflict: "user_id" });
}

async function upsertVoiceProfileToSupabase(voiceProfile: VoiceProfile) {
  if (!isSupabaseConfigured || voiceProfile.userId === "local-demo-user") return;
  const supabase = await createSupabaseBrowserClient();
  if (!supabase) return;
  await supabase.from("voice_profiles").upsert({
    user_id: voiceProfile.userId,
    sample_audio_url: voiceProfile.sampleAudioUrl,
    sample_storage_path: voiceProfile.sampleStoragePath,
    voice_embedding_id: voiceProfile.voiceEmbeddingId,
    enrollment_status: voiceProfile.enrollmentStatus
  }, { onConflict: "user_id" });
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
    onboardingCompleted: row.onboarding_completed === true,
    onboardingCompletedAt: typeof row.onboarding_completed_at === "string" ? row.onboarding_completed_at : null,
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

function resolveResumeStep(input: {
  profile: UserProfile | null;
  voiceProfile: VoiceProfile | null;
  selfCheck: OnboardingSelfCheck | null;
}) {
  if (!input.profile) return 1;
  if (!hasCompletedQuestions(input.profile, input.selfCheck)) return 2;
  if (!input.voiceProfile) return 5;
  return 6;
}

function hasCompletedQuestions(profile: UserProfile, selfCheck: OnboardingSelfCheck | null) {
  return Boolean(
    profile.primaryGoal &&
    profile.mainPainPoints.length > 0 &&
    selfCheck?.answers.help_context &&
    selfCheck.answers.difficulty &&
    selfCheck.answers.improvement_goal
  );
}
