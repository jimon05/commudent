"use client";

import { createSupabaseBrowserClient, isSupabaseConfigured, missingSupabasePublicEnv } from "@/lib/supabase";

export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseBrowserClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  return data.user;
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = await createSupabaseBrowserClient();
  if (!supabase) throw new Error(buildSupabaseConfigError());
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signUpWithEmail(email: string, password: string) {
  const supabase = await createSupabaseBrowserClient();
  if (!supabase) throw new Error(buildSupabaseConfigError());
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (!data.session) {
    throw new Error("가입은 접수되었지만 이메일 인증 설정이 켜져 있습니다. Supabase Auth에서 Confirm email을 OFF로 하면 바로 테스트할 수 있습니다.");
  }
}

export async function signInWithGoogle() {
  const supabase = await createSupabaseBrowserClient();
  if (!supabase) throw new Error(buildSupabaseConfigError());
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/onboarding` }
  });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  const supabase = await createSupabaseBrowserClient();
  await supabase?.auth.signOut();
}

function buildSupabaseConfigError() {
  if (missingSupabasePublicEnv.length > 0) {
    return `Supabase public 환경변수가 누락되었습니다: ${missingSupabasePublicEnv.join(", ")}`;
  }
  return "Supabase 클라이언트를 초기화하지 못했습니다. NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 값과 @supabase/supabase-js 설치 상태를 확인해 주세요.";
}
