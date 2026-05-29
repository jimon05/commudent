"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { isSupabaseConfigured, missingSupabasePublicEnv } from "@/lib/supabase";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/services/authService";
import { getOnboardingStatus } from "@/services/profileService";

type AuthSuccessStatus = Awaited<ReturnType<typeof getOnboardingStatus>>;

export function AuthPanel({ compact = false, onAuthSuccess }: { compact?: boolean; onAuthSuccess?: (status: AuthSuccessStatus) => void }) {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(isSupabaseConfigured ? "" : `Supabase public 환경변수가 누락되었습니다: ${missingSupabasePublicEnv.join(", ")}`);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    setIsSubmitting(true);
    setMessage("");
    try {
      if (mode === "signin") await signInWithEmail(email, password);
      else await signUpWithEmail(email, password);
      const status = await getOnboardingStatus();
      setMessage(mode === "signin" ? "로그인되었습니다." : "가입과 로그인이 완료되었습니다.");
      if (onAuthSuccess) {
        onAuthSuccess(status);
        return;
      }
      window.location.href = status.onboardingCompleted ? (nextPath || "/") : "/onboarding";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "인증 처리 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className={`rounded-lg border border-line bg-white p-5 shadow-sm ${compact ? "" : "mx-auto max-w-md"}`}>
      <p className="text-xs font-black uppercase tracking-normal text-marine">Account</p>
      <h1 className="mt-2 text-2xl font-black text-ink">내 말하기 데이터 저장소 만들기</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">로그인하면 녹음, 리포트, 훈련 결과가 Supabase에 사용자별로 저장됩니다.</p>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
        {(["signin", "signup"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={`h-10 rounded-md text-sm font-black transition ${mode === item ? "bg-white text-ink shadow-sm" : "text-slate-500"}`}
          >
            {item === "signin" ? "로그인" : "회원가입"}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-sm font-bold text-slate-700">
        이메일
        <input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-line px-3 outline-none focus:border-marine" />
      </label>
      <label className="mt-3 block text-sm font-bold text-slate-700">
        비밀번호
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-line px-3 outline-none focus:border-marine" />
      </label>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={submit} disabled={isSubmitting || !email || password.length < 6} className="h-11 rounded-lg bg-teal-300 px-5 text-sm font-black text-slate-950 shadow-sm transition hover:bg-teal-200 disabled:bg-slate-300 disabled:text-slate-500">
          {isSubmitting ? "처리 중" : mode === "signin" ? "로그인" : "가입하기"}
        </button>
        <button type="button" onClick={() => signInWithGoogle().catch((error) => setMessage(error.message))} className="h-11 rounded-lg border border-line bg-white px-5 text-sm font-black text-slate-700">
          Google
        </button>
      </div>
      {message ? <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-600">{message}</p> : null}
    </section>
  );
}
