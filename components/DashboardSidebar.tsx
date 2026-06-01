"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/services/authService";

const menuItems = [
  { label: "홈", href: "/" },
  { label: "발표 이력", href: "/" },
  { label: "발표 전 준비", href: "/record?mode=prep" },
  { label: "발표 후 녹음", href: "/record?mode=live" },
  { label: "설정", href: "/onboarding" }
];

const bottomItems = [
  { label: "다음 발표 준비하기", href: "/record?mode=prep" },
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
            <span className="block text-xs font-bold text-slate-400">핵심 내용 전달 피드백</span>
          </span>
        </Link>

        <Link href="/record?mode=prep" className="mt-6 flex h-12 items-center justify-center rounded-lg bg-teal-300 px-4 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(45,212,191,0.18)]">
          발표 준비 시작
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
        <Link href="/record?mode=prep" className="rounded-md bg-teal-300 px-2 py-2 text-center text-xs font-black text-slate-950">
          준비
        </Link>
        <Link href="/record?mode=live" className="rounded-md px-2 py-2 text-center text-xs font-black text-slate-300">
          녹음
        </Link>
      </nav>
    </>
  );
}
