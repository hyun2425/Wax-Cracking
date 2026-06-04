import type { Metadata } from "next";
import Link from "next/link";
import HshRapierExperience from "./HshRapierExperience";

export const metadata: Metadata = {
  title: "HSH.ver2 | Rapier 왁스뿌볼",
  description: "Next.js, Three.js, Rapier로 만든 물리 기반 왁스뿌볼 실험",
};

export default function HshVer2Page() {
  return (
    <main className="min-h-screen bg-[#111416] text-[#fff8ec]">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-white/10 bg-[#111416]/78 backdrop-blur-md">
        <nav
          aria-label="주요 메뉴"
          className="mx-auto flex min-h-16 w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4 max-sm:flex-col max-sm:items-start max-sm:justify-center max-sm:py-4"
        >
          <Link className="text-[15px] font-extrabold" href="/">
            Online Wax-Cracking Ball
          </Link>
          <div className="flex flex-wrap gap-5 text-sm font-bold text-[#c6d3da]">
            <Link href="/">홈</Link>
            <Link href="/hsj-ver">HSJ.ver</Link>
            <Link href="/hsh-ver2">HSH.ver2</Link>
          </div>
        </nav>
      </header>

      <HshRapierExperience />
    </main>
  );
}
