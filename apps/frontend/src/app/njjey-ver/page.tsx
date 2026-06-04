import type { Metadata } from "next";
import Link from "next/link";

const versionLinks = [
  { href: "/", label: "mk.ver" },
  { href: "/hsj-ver", label: "hsj.ver" },
  { href: "/njjey-ver", label: "njjey.ver" },
];

export const metadata: Metadata = {
  title: "njjey.ver | 온라인 왁스뿌볼",
  description: "njjey.ver 준비 페이지",
};

export default function NjjeyVerPage() {
  return (
    <main className="min-h-screen bg-[#101317] text-[#f7f2e8]">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-white/10 bg-[#101317]/78 backdrop-blur-md">
        <nav
          aria-label="버전 메뉴"
          className="mx-auto flex min-h-16 w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4 max-sm:flex-col max-sm:items-start max-sm:justify-center max-sm:py-4"
        >
          <Link className="text-[15px] font-extrabold" href="/">
            Online Wax-Cracking Ball
          </Link>
          <div className="flex flex-wrap gap-5 text-sm font-extrabold text-[#c6d3da]">
            {versionLinks.map((link) => (
              <Link
                className={link.href === "/njjey-ver" ? "text-[#fff8ec]" : "hover:text-[#fff8ec]"}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
    </main>
  );
}
