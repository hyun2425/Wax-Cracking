"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Need = "hunger" | "fun" | "energy";

const actions: { key: Need; icon: string; label: string; detail: string; color: string }[] = [
  { key: "hunger", icon: "🎋", label: "대나무 주기", detail: "배고픔 +24", color: "#ef8b4d" },
  { key: "fun", icon: "🧶", label: "공놀이", detail: "즐거움 +22", color: "#d86363" },
  { key: "energy", icon: "🛏️", label: "낮잠 자기", detail: "체력 +26", color: "#5978b8" },
];

const messages = {
  hunger: ["아삭아삭! 대나무가 제일 좋아.", "양손으로 꼭 잡고 맛있게 먹는 중!", "대나무 잎까지 남김없이 냠냠."],
  fun: ["데굴데굴! 공이 도망가요!", "꼬리가 풍성해질 만큼 신났어!", "한 번 더 놀자고 눈을 반짝여요."],
  energy: ["나무 위에서 포근하게 낮잠…", "하품 한 번, 기분 좋은 충전 완료!", "웅크리고 쉬니 체력이 돌아왔어."],
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

type SaveData = { name?: string; needs?: Record<Need, number>; coins?: number; xp?: number };

function getSavedGame(): SaveData {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem("red-panda-care") ?? "{}") as SaveData;
  } catch {
    return {};
  }
}

export default function RedPandaPage() {
  const [name, setName] = useState(() => getSavedGame().name ?? "모찌");
  const [needs, setNeeds] = useState<Record<Need, number>>(() => getSavedGame().needs ?? { hunger: 68, fun: 62, energy: 74 });
  const [coins, setCoins] = useState(() => getSavedGame().coins ?? 18);
  const [xp, setXp] = useState(() => getSavedGame().xp ?? 35);
  const [message, setMessage] = useState("모찌가 새 보금자리를 둘러보고 있어요.");
  const [isSleeping, setIsSleeping] = useState(false);
  const [actionCount, setActionCount] = useState(0);

  useEffect(() => {
    window.localStorage.setItem("red-panda-care", JSON.stringify({ name, needs, coins, xp }));
  }, [coins, name, needs, xp]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNeeds((current) => ({
        hunger: clamp(current.hunger - 2),
        fun: clamp(current.fun - 1),
        energy: clamp(current.energy - 1),
      }));
    }, 12000);
    return () => window.clearInterval(timer);
  }, []);

  const level = Math.floor(xp / 100) + 1;
  const levelProgress = xp % 100;
  const mood = useMemo(() => Math.round((needs.hunger + needs.fun + needs.energy) / 3), [needs]);

  function careFor(key: Need) {
    const action = actions.find((item) => item.key === key)!;
    const gain = key === "hunger" ? 24 : key === "fun" ? 22 : 26;
    const nextMessage = messages[key][actionCount % messages[key].length];
    setNeeds((current) => ({ ...current, [key]: clamp(current[key] + gain) }));
    setXp((current) => current + 14);
    setCoins((current) => current + 3);
    setActionCount((current) => current + 1);
    setMessage(nextMessage);
    if (key === "energy") {
      setIsSleeping(true);
      window.setTimeout(() => setIsSleeping(false), 2200);
    }
    void action;
  }

  function explore() {
    const finds = ["반짝이는 솔방울을 찾았어요! 코인 +8", "대나무 숲에서 새 친구를 만났어요! 즐거움 +10", "작은 폭포를 발견했어요! 체력 +8"];
    const choice = actionCount % finds.length;
    setMessage(finds[choice]);
    setCoins((current) => current + 8);
    setXp((current) => current + 10);
    setActionCount((current) => current + 1);
    setNeeds((current) => ({ ...current, fun: clamp(current.fun + 10), energy: clamp(current.energy + 8) }));
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#fff7eb] text-[#3f2a22]">
      <div className="mx-auto w-[min(1060px,calc(100%-32px))] py-6">
        <nav className="flex items-center justify-between gap-4">
          <Link className="text-sm font-black text-[#8a5540] hover:text-[#d85e42]" href="/">← 게임 목록</Link>
          <div className="rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm">🪙 {coins} 밤톨</div>
        </nav>

        <header className="mt-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-black tracking-[0.18em] text-[#d85e42]">RED PANDA CARE CLUB</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] sm:text-5xl">레서판다 키우기</h1>
            <p className="mt-3 font-bold text-[#8a6559]">오늘도 {name}와 느긋한 숲속 하루를 보내요.</p>
          </div>
          <label className="rounded-2xl border border-[#f0d8ba] bg-white px-4 py-3 text-sm font-bold shadow-sm">
            이름
            <input aria-label="레서판다 이름" className="ml-3 w-20 border-b border-[#e6caa9] bg-transparent text-center font-black outline-none" maxLength={8} value={name} onChange={(event) => setName(event.target.value || "모찌")} />
          </label>
        </header>

        <section className="mt-7 grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">
          <div className="relative min-h-[440px] overflow-hidden rounded-[32px] border border-[#f1d7b9] bg-[linear-gradient(160deg,#b9e5d0_0%,#e9f5c5_54%,#f9dba8_100%)] p-6 shadow-[0_20px_50px_rgba(157,91,52,0.16)]">
            <div className="absolute left-[-40px] top-16 h-44 w-44 rounded-full bg-[#8ac28a]/35 blur-2xl" />
            <div className="absolute right-[-50px] bottom-[-45px] h-56 w-56 rounded-full bg-[#f3b369]/35 blur-2xl" />
            <div className="relative flex items-start justify-between">
              <div className="rounded-2xl bg-white/75 px-4 py-3 backdrop-blur"><p className="text-xs font-black text-[#a55f45]">LEVEL {level}</p><p className="text-lg font-black">숲속 꼬마</p></div>
              <div className="rounded-2xl bg-white/75 px-4 py-3 text-right backdrop-blur"><p className="text-xs font-black text-[#a55f45]">기분</p><p className="text-lg font-black">{mood}%</p></div>
            </div>
            <div className="red-panda-meadow relative mt-6 h-72 overflow-hidden rounded-[26px] border border-white/45 bg-[#c8e7a8]/35">
              <span className="absolute bottom-4 left-[8%] text-3xl">🌿</span><span className="absolute bottom-7 right-[12%] text-2xl">🌱</span><span className="absolute bottom-3 right-[34%] text-xl">🍄</span>
              <div className={`red-panda-walker ${isSleeping ? "is-sleeping" : ""}`}>
                <Image src="/red-panda/red-panda-walk.png" alt={`${name} 레서판다`} fill priority sizes="(max-width: 640px) 280px, 370px" />
              </div>
            </div>
            <p className="relative mx-auto mt-5 max-w-md rounded-2xl bg-white/80 px-5 py-4 text-center font-bold leading-6 shadow-sm">“{message}”</p>
          </div>

          <aside className="rounded-[32px] border border-[#f1d7b9] bg-white p-6 shadow-[0_16px_40px_rgba(157,91,52,0.1)]">
            <h2 className="text-xl font-black">{name}의 오늘</h2>
            <div className="mt-5 space-y-5">
              {actions.map((action) => <div key={action.key}><div className="mb-2 flex justify-between text-sm font-black"><span>{action.icon} {action.key === "hunger" ? "배부름" : action.key === "fun" ? "즐거움" : "체력"}</span><span>{needs[action.key]}%</span></div><div className="h-3 overflow-hidden rounded-full bg-[#f4eadf]"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${needs[action.key]}%`, background: action.color }} /></div></div>)}
            </div>
            <div className="mt-8 border-t border-[#f1e2d2] pt-5"><div className="flex justify-between text-sm font-black"><span>다음 레벨까지</span><span>{levelProgress}/100</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f4eadf]"><div className="h-full rounded-full bg-[#8aaf58]" style={{ width: `${levelProgress}%` }} /></div></div>
          </aside>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          {actions.map((action) => <button key={action.key} type="button" onClick={() => careFor(action.key)} className="group rounded-3xl border border-[#f0d8ba] bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><span className="text-3xl">{action.icon}</span><strong className="mt-3 block text-lg">{action.label}</strong><span className="mt-1 block text-sm font-bold text-[#9a7467]">{action.detail} · 경험치 +14</span></button>)}
        </section>
        <button type="button" onClick={explore} className="mt-6 w-full rounded-3xl bg-[#5f8d51] px-6 py-5 text-lg font-black text-white shadow-[0_12px_24px_rgba(72,117,65,0.25)] transition hover:bg-[#527b46]">🌲 대나무 숲 탐험하기 <span className="ml-2 text-sm opacity-80">랜덤 보상 획득</span></button>
      </div>
      <style jsx>{`
        .red-panda-meadow::after { content: ""; position: absolute; inset: auto 0 0; height: 42px; background: repeating-linear-gradient(90deg, rgba(74,130,62,.32) 0 3px, transparent 3px 18px); opacity: .6; }
        .red-panda-walker { position: absolute; bottom: 23px; left: -12%; width: 350px; height: 255px; animation: panda-stroll 11s ease-in-out infinite alternate; }
        .red-panda-walker :global(img) { object-fit: contain; filter: drop-shadow(0 15px 10px rgba(74, 66, 36, .18)); }
        .is-sleeping { animation-play-state: paused; transform: translateX(42%) scale(.84) rotate(5deg); transform-origin: bottom center; }
        @keyframes panda-stroll { 0% { transform: translateX(0) translateY(0); } 25% { transform: translateX(42%) translateY(-5px); } 55% { transform: translateX(115%) translateY(0); } 78% { transform: translateX(164%) translateY(-5px) scaleX(-1); } 100% { transform: translateX(208%) translateY(0) scaleX(-1); } }
        @media (max-width: 640px) { .red-panda-walker { width: 275px; height: 220px; left: -22%; animation-name: panda-stroll-small; } @keyframes panda-stroll-small { 0% { transform: translateX(0); } 100% { transform: translateX(130%) scaleX(-1); } } }
      `}</style>
    </main>
  );
}
