"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/services/authService";

const menuItems = [
  { label: "홈", href: "/" },
  { label: "전체 녹음", href: "/" },
  { label: "장기 리포트", href: "/long-report" },
  { label: "스크립트 코칭", href: "/script-coach" },
  { label: "설정", href: "/onboarding" }
];

const bottomItems = [
  { label: "대본 코칭 바로가기", href: "/script-coach" },
  { label: "개인정보/음성 데이터 관리", href: "/onboarding" }
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  return (
    <>
      <aside className="hidden min-h-screen w-[272px] shrink-0 border-r border-white/10 bg-slate-950/92 px-4 py-5 lg:flex lg:flex-col">
        <Link href="/" className="flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-300 text-sm font-black text-slate-950">C</span>
          <span>
            <span className="block text-lg font-black text-white">COMMUDENT</span>
            <span className="block text-xs font-bold text-slate-400">기록 기반 말하기 코칭</span>
          </span>
        </Link>

        <Link href="/record" className="mt-6 flex h-12 items-center justify-center rounded-lg bg-teal-300 px-4 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(45,212,191,0.18)]">
          녹음 시작하기
        </Link>

        <nav className="mt-7 space-y-1">
          {menuItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" || pathname === "/dashboard" : pathname.startsWith(item.href);
            return (
              <Link key={item.label} href={item.href} className={`flex h-11 items-center rounded-lg px-3 text-sm font-black transition ${active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2 border-t border-white/10 pt-4">
          {bottomItems.map((item) => (
            <Link key={item.label} href={item.href} className="block rounded-lg px-3 py-2 text-xs font-bold leading-5 text-slate-400 hover:bg-white/5 hover:text-white">
              {item.label}
            </Link>
          ))}
          <button type="button" onClick={handleSignOut} className="w-full rounded-lg px-3 py-2 text-left text-xs font-black text-slate-400 hover:bg-white/5 hover:text-white">
            로그아웃
          </button>
        </div>
      </aside>

      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-slate-950/92 p-2 shadow-soft backdrop-blur lg:hidden">
        <Link href="/" className="rounded-md px-2 py-2 text-center text-xs font-black text-white">
          홈
        </Link>
        <Link href="/record" className="rounded-md bg-teal-300 px-2 py-2 text-center text-xs font-black text-slate-950">
          녹음
        </Link>
        <Link href="/script-coach" className="rounded-md px-2 py-2 text-center text-xs font-black text-slate-300">
          대본
        </Link>
      </nav>
    </>
  );
}
