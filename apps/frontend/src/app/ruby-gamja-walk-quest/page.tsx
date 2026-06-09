import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ruby & Gamja Walk Quest",
  description: "루비와 감자를 산책시키는 웹 게임 프로젝트 시작 화면",
};

const walkRoutes = [
  {
    name: "햇살 공원",
    mood: "여유",
    detail: "나무 그늘과 벤치가 있는 기본 산책 코스",
  },
  {
    name: "동네 골목",
    mood: "탐험",
    detail: "냄새 포인트와 작은 이벤트가 많은 코스",
  },
  {
    name: "강변 산책로",
    mood: "상쾌",
    detail: "체력 회복과 긴 산책 보너스를 노리는 코스",
  },
];

const quests = [
  "루비 간식 게이지 3칸 채우기",
  "감자 냄새 탐색 포인트 5개 찾기",
  "둘이 같은 속도로 30초 걷기",
];

export default function RubyGamjaWalkQuestPage() {
  return (
    <main className="min-h-screen bg-[#f8f1e7] text-[#251a12]">
      <header className="border-b border-[#e5d4c0] bg-[#fffaf2]/90 backdrop-blur">
        <nav
          aria-label="게임 메뉴"
          className="mx-auto flex min-h-16 w-[min(1180px,calc(100%-32px))] items-center justify-between gap-5 max-md:flex-col max-md:items-start max-md:py-4"
        >
          <Link className="text-sm font-extrabold text-[#7a5538]" href="/">
            Wax-Cracking Home
          </Link>
          <div className="flex flex-wrap gap-4 text-sm font-extrabold text-[#8a6a4f]">
            <Link href="/">왁뿌볼</Link>
            <Link className="text-[#2c7a43]" href="/ruby-gamja-walk-quest">
              Ruby & Gamja
            </Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid w-[min(1180px,calc(100%-32px))] grid-cols-[minmax(0,0.9fr)_minmax(320px,1fr)] items-center gap-10 py-12 max-lg:grid-cols-1">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#2c7a43]">
            New Game Setup
          </p>
          <h1 className="mt-3 text-5xl font-black leading-tight text-[#251a12] max-sm:text-4xl">
            Ruby & Gamja Walk Quest
          </h1>
          <p className="mt-5 max-w-2xl text-lg font-bold leading-8 text-[#735b48]">
            루비와 감자를 데리고 산책 코스를 돌며 체력, 기분, 간식, 탐색
            미션을 관리하는 귀여운 산책 게임으로 시작합니다.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <span className="rounded-full bg-[#2c7a43] px-4 py-2 text-sm font-extrabold text-white">
              URL: /ruby-gamja-walk-quest
            </span>
            <span className="rounded-full border border-[#e0cbb4] bg-white px-4 py-2 text-sm font-extrabold text-[#7a5538]">
              작업명: Ruby-Gamja-Walk-Quest
            </span>
          </div>
        </div>

        <div className="relative min-h-[420px] overflow-hidden rounded-lg border border-[#e0cbb4] bg-[#bfe8c2] shadow-[0_24px_60px_rgba(80,55,33,0.18)]">
          <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[#8bcf88]" />
          <div className="absolute left-[-10%] top-[16%] h-48 w-48 rounded-full bg-[#fff5c9]" />
          <div className="absolute bottom-10 left-1/2 h-28 w-[130%] -translate-x-1/2 rounded-[50%] bg-[#e8d4b4]" />
          <div className="absolute bottom-24 left-[18%] h-20 w-20 rounded-full bg-[#75462d] shadow-[inset_-8px_-10px_0_rgba(0,0,0,0.14)]">
            <span className="absolute -top-5 left-2 h-8 w-7 -rotate-12 rounded-full bg-[#75462d]" />
            <span className="absolute -top-5 right-2 h-8 w-7 rotate-12 rounded-full bg-[#75462d]" />
            <span className="absolute left-5 top-7 h-2 w-2 rounded-full bg-[#21140d] shadow-[22px_0_0_#21140d]" />
            <span className="absolute bottom-4 left-1/2 h-2 w-5 -translate-x-1/2 rounded-full bg-[#f4c0a4]" />
            <span className="absolute -bottom-8 left-5 h-10 w-3 rounded-full bg-[#75462d] shadow-[28px_0_0_#75462d]" />
          </div>
          <div className="absolute bottom-20 right-[18%] h-16 w-24 rounded-[50%] bg-[#f1c46b] shadow-[inset_-8px_-9px_0_rgba(0,0,0,0.12)]">
            <span className="absolute -top-4 left-5 h-7 w-6 -rotate-12 rounded-full bg-[#b67832]" />
            <span className="absolute -top-4 right-5 h-7 w-6 rotate-12 rounded-full bg-[#b67832]" />
            <span className="absolute left-7 top-6 h-2 w-2 rounded-full bg-[#21140d] shadow-[28px_0_0_#21140d]" />
            <span className="absolute bottom-4 left-1/2 h-2 w-5 -translate-x-1/2 rounded-full bg-[#8b5430]" />
            <span className="absolute -bottom-7 left-7 h-9 w-3 rounded-full bg-[#f1c46b] shadow-[38px_0_0_#f1c46b]" />
          </div>
          <div className="absolute left-[33%] top-[38%] rounded-full bg-white/78 px-4 py-2 text-sm font-black text-[#2c7a43] shadow">
            산책 출발 준비!
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-[min(1180px,calc(100%-32px))] grid-cols-[1.1fr_0.9fr] gap-6 pb-14 max-lg:grid-cols-1">
        <div className="rounded-lg border border-[#e0cbb4] bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">산책 코스</h2>
          <div className="mt-4 grid gap-3">
            {walkRoutes.map((route) => (
              <button
                className="flex min-h-20 items-center justify-between gap-4 rounded-lg border border-[#ead9c7] bg-[#fffaf4] p-4 text-left transition hover:border-[#8bcf88]"
                key={route.name}
                type="button"
              >
                <span>
                  <strong className="block text-lg">{route.name}</strong>
                  <span className="text-sm font-bold text-[#7d6755]">
                    {route.detail}
                  </span>
                </span>
                <span className="rounded-full bg-[#e3f4df] px-3 py-2 text-xs font-black text-[#2c7a43]">
                  {route.mood}
                </span>
              </button>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-[#e0cbb4] bg-[#fffaf4] p-5 shadow-sm">
          <h2 className="text-2xl font-black">오늘의 퀘스트</h2>
          <ul className="mt-4 grid gap-3">
            {quests.map((quest) => (
              <li
                className="rounded-lg border border-[#ead9c7] bg-white px-4 py-3 text-sm font-extrabold text-[#5d4939]"
                key={quest}
              >
                {quest}
              </li>
            ))}
          </ul>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Status label="Ruby" value="기분 좋음" />
            <Status label="Gamja" value="탐색 준비" />
            <Status label="체력" value="100%" />
            <Status label="간식" value="3개" />
          </div>
        </aside>
      </section>
    </main>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f2eadf] p-4">
      <p className="text-xs font-black uppercase text-[#8a6a4f]">{label}</p>
      <p className="mt-1 text-lg font-black text-[#251a12]">{value}</p>
    </div>
  );
}
