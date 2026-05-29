"use client";

import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import type { CauseType, TrainingSession, TrainingType } from "@/types/speech";

const trainingKey = "speech-coach-training-sessions";

export function readLocalTrainingSessions(): TrainingSession[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(trainingKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as TrainingSession[];
  } catch {
    return [];
  }
}

export async function saveTrainingSession(input: {
  trainingType: TrainingType;
  targetCause: CauseType;
  prompt: string;
  result: Record<string, string | number | boolean>;
}) {
  const userId = await getUserId();
  const session: TrainingSession = {
    id: `training-${Date.now()}`,
    userId: userId ?? "local-demo-user",
    trainingType: input.trainingType,
    targetCause: input.targetCause,
    prompt: input.prompt,
    result: input.result,
    completedAt: new Date().toISOString()
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(trainingKey, JSON.stringify([session, ...readLocalTrainingSessions()].slice(0, 20)));
  }

  if (isSupabaseConfigured && userId) {
    const supabase = await createSupabaseBrowserClient();
    await supabase?.from("training_sessions").insert({
      user_id: userId,
      training_type: input.trainingType,
      target_cause: input.targetCause,
      prompt: input.prompt,
      result: input.result
    });
  }

  return session;
}

async function getUserId() {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseBrowserClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  return data.user?.id ?? null;
}
