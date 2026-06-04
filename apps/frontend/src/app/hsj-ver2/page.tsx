import type { Metadata } from "next";
import Link from "next/link";
import HsjVer2RapierExperience from "./HsjVer2RapierExperience";

const versionLinks = [
  { href: "/hsj-ver", label: "hsj.ver" },
  { href: "/hsj-ver2", label: "hsj.ver2" },
];

export const metadata: Metadata = {
  title: "hsj.ver2 | Rapier 왁스뿌볼",
  description: "Next.js, Three.js, Rapier로 만든 hsj.ver2 물리 기반 왁스뿌볼 실험",
};

export default function HsjVer2Page() {
  return (
    <main className="min-h-screen bg-[#111416] text-[#fff8ec]">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-white/10 bg-[#111416]/78 backdrop-blur-md">
        <nav
          aria-label="버전 메뉴"
          className="mx-auto flex min-h-16 w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4 max-sm:flex-col max-sm:items-start max-sm:justify-center max-sm:py-4"
        >
          <Link className="text-[15px] font-extrabold" href="/hsj-ver">
            Online Wax-Cracking Ball
          </Link>
          <div className="flex flex-wrap gap-5 text-sm font-extrabold text-[#c6d3da]">
            {versionLinks.map((link) => (
              <Link
                className={link.href === "/hsj-ver2" ? "text-[#fff8ec]" : "hover:text-[#fff8ec]"}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <HsjVer2RapierExperience />
    </main>
  );
}
