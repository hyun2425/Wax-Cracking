"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Menu = { id: string; name: string; votes: number };
type RankedMenu = Menu & { rank: number };
type VoteState = { type?: string; room: string; hostId: string; you: string; participants: number; voters: number; menus: Menu[]; myVotes: string[] };
const empty: VoteState = { room: "", hostId: "", you: "", participants: 0, voters: 0, menus: [], myVotes: [] };
const makeCode = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
const socketBase = () => (process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? (location.hostname === "localhost" ? "http://localhost:8080" : "https://wax-cracking-backend.onrender.com")).replace(/^http/, "ws");
const restaurantGuide: Record<string, { name: string; note: string }> = {
  "회·해산물": { name: "잡어와묵은지", note: "강남역 도보권 · 단체석 · 예약 가능" },
  "족발·보쌈": { name: "가장맛있는족발 강남1호점", note: "강남역권 · 단체석 · 예약 가능" },
  "삼겹살·돼지고기": { name: "청기와타운", note: "강남역 도보권 · 룸·단체석 · 네이버/캐치테이블 예약" },
  "소고기·갈비": { name: "일편등심 강남점", note: "강남역권 · 최대 14인 단독 룸 · 예약 가능" },
  "양고기": { name: "양파이 강남점", note: "강남역 도보권 · 룸·단체석 · 예약 가능" },
  "곱창·대창": { name: "세광양대창 강남역중앙점", note: "강남역 도보권 · 네이버/캐치테이블 예약" },
  "닭구이·치킨": { name: "칸나 닭집", note: "강남역 4번 출구권 · 예약 가능 · 단체 회식 적합" },
  "중식": { name: "중화객잔수 강남점", note: "강남역 도보권 · 전석 룸 중심 · 단체 예약" },
  "양식": { name: "마노디셰프 강남점", note: "강남역권 · 최대 50인 단체룸 · 네이버/캐치테이블 예약" },
  "한식주점·전골": { name: "장서는날", note: "강남역 도보권 · 100석 이상 단체석 · 네이버 예약" },
};
const secondStops = [
  { name: "이자카야나무 삼성타운점", note: "강남역 5번 출구권 · 룸·단체 이용 · 네이버 예약 가능" },
  { name: "이자카야나무 강남역3호점", note: "강남역권 · 전층 룸 · 네이버 예약 가능" },
  { name: "이자카야나무 논현점", note: "신논현·논현권 · 단체석 · 네이버 예약 가능" },
  { name: "정글", note: "강남역 지오다노골목 · 단체석 · 예약 가능" },
  { name: "언더그라운드", note: "강남역권 · 맥주·펍 · 단체석 예약 가능" },
];

export default function DinnerVotePage() {
  const [code, setCode] = useState(""); const [room, setRoom] = useState(""); const [state, setState] = useState(empty); const [picked, setPicked] = useState<string[]>([]); const [newMenu, setNewMenu] = useState(""); const [topCount, setTopCount] = useState(3); const [winner, setWinner] = useState<RankedMenu | null>(null); const ws = useRef<WebSocket | null>(null);
  useEffect(() => { if (!room) return; const socket = new WebSocket(`${socketBase()}/ws/dinner-vote?room=${room}`); ws.current = socket; socket.onmessage = (event) => { const next = JSON.parse(event.data) as VoteState; if (next.type === "state") { setState(next); setPicked(next.myVotes); } }; return () => socket.close(); }, [room]);
  const isHost = state.you === state.hostId; const canVote = picked.length === 2; const ranked = useMemo(() => state.menus.map((menu, index) => ({ ...menu, rank: index + 1 })), [state.menus]);
  function toggle(id: string) { setWinner(null); setPicked(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 2 ? [...current, id] : current); }
  function submitVote() { if (canVote) ws.current?.send(JSON.stringify({ type: "vote", menuIds: picked })); }
  function chooseRandom() {
    const candidates = ranked.slice(0, Math.min(topCount, ranked.length));
    if (!candidates.length) return;
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    const guide = restaurantGuide[selected.name];
    setWinner(selected);
    if (guide) {
      const secondStopList = secondStops.map((place, index) => `${index + 1}. ${place.name} — ${place.note}`).join("\n");
      window.setTimeout(() => window.alert(`1차 예약 추천: ${guide.name}\n${guide.note}\n\n근처 2차 후보\n${secondStopList}\n\n검색 결과에서 예약 가능 시간과 단체석을 최종 확인해 주세요.`), 0);
    }
  }
  if (!room) return <main className="min-h-screen bg-[#fff8ef] px-4 py-8 text-[#24201b]"><div className="mx-auto max-w-2xl"><Link href="/" className="text-sm font-bold text-[#8a6c54]">← 홈으로</Link><section className="mt-12 rounded-[2rem] border border-[#f0d8bd] bg-white p-8 shadow-xl shadow-orange-100"><p className="font-black tracking-[.24em] text-[#e8743b]">TEAM DINNER</p><h1 className="mt-3 text-4xl font-black">오늘 회식, 뭘 먹을까?</h1><p className="mt-3 text-[#78695d]">이름 없이 입장해 먹고 싶은 음식 종류 2개를 익명 투표하세요.</p><div className="mt-8 flex flex-wrap gap-3"><button onClick={() => setRoom(makeCode())} className="rounded-xl bg-[#e8743b] px-5 py-3 font-black text-white">새 익명 투표방 만들기</button><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="방 코드" className="w-32 rounded-xl border border-[#ead7c5] px-3 font-bold" /><button disabled={!code.trim()} onClick={() => setRoom(code)} className="rounded-xl border border-[#e8743b] px-5 font-black text-[#c85e2c] disabled:opacity-40">익명 입장</button></div></section></div></main>;
  return <main className="min-h-screen bg-[#fff8ef] px-4 py-7 text-[#24201b]"><div className="mx-auto max-w-5xl"><nav className="flex items-center justify-between"><Link href="/" className="text-sm font-bold text-[#8a6c54]">← 홈으로</Link><span className="rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm">방 코드 <b className="ml-2 tracking-[.18em] text-[#e8743b]">{state.room}</b></span></nav><header className="mt-10 flex flex-wrap items-end justify-between gap-4"><div><p className="font-black tracking-[.24em] text-[#e8743b]">DINNER VOTE</p><h1 className="mt-2 text-4xl font-black">먹고 싶은 음식 종류 2개를 골라요</h1><p className="mt-2 text-[#78695d]">투표 완료 {state.voters}명 · 참여 중 {state.participants}명 · 최종 종류가 정해지면 단체석 식당을 고릅니다.</p></div><span className={`rounded-xl px-4 py-3 text-sm font-black ${canVote ? "bg-[#dbf2df] text-[#27743b]" : "bg-[#fff0d8] text-[#a9651c]"}`}>{canVote ? "2개 선택 완료" : `${picked.length}/2 선택`}</span></header><section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_.95fr]"><div className="rounded-[2rem] border border-[#f0d8bd] bg-white p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-black">음식 종류 투표</h2><button disabled={!canVote} onClick={submitVote} className="rounded-xl bg-[#24201b] px-4 py-2.5 text-sm font-black text-white disabled:opacity-35">내 투표 제출</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{state.menus.map(menu => <button key={menu.id} onClick={() => toggle(menu.id)} className={`rounded-2xl border p-4 text-left transition ${picked.includes(menu.id) ? "border-[#e8743b] bg-[#fff1e8] ring-2 ring-[#e8743b]/20" : "border-[#eee1d5] hover:border-[#efb18b]"}`}><span className="text-2xl">{picked.includes(menu.id) ? "✓" : "🍽️"}</span><strong className="mt-3 block text-lg">{menu.name}</strong><span className="mt-1 block text-sm text-[#8a796b]">{menu.votes}표</span></button>)}</div>{isHost && <form onSubmit={e => { e.preventDefault(); if (newMenu.trim()) { ws.current?.send(JSON.stringify({ type: "addMenu", name: newMenu })); setNewMenu(""); } }} className="mt-5 flex gap-2"><input value={newMenu} onChange={e => setNewMenu(e.target.value)} maxLength={24} placeholder="음식 종류 직접 추가" className="min-w-0 flex-1 rounded-xl border border-[#ead7c5] px-4 py-3"/><button className="rounded-xl border border-[#e8743b] px-4 font-black text-[#c85e2c]">추가</button></form>}</div><aside className="rounded-[2rem] bg-[#24201b] p-6 text-white"><h2 className="text-xl font-black">현재 순위</h2><ol className="mt-5 space-y-3">{ranked.map(menu => <li key={menu.id} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3"><b className="w-7 text-xl text-[#ffc972]">{menu.rank}</b><span className="flex-1 font-bold">{menu.name}</span><strong>{menu.votes}표</strong></li>)}</ol><div className="mt-8 border-t border-white/15 pt-6"><p className="text-sm font-bold text-[#d6cac0]">상위 음식 종류 중 랜덤 선택</p><div className="mt-3 flex gap-2">{[1,2,3].map(count => <button key={count} onClick={() => { setTopCount(count); setWinner(null); }} className={`rounded-lg px-3 py-2 text-sm font-black ${topCount === count ? "bg-[#ffc972] text-[#36230e]" : "bg-white/10"}`}>TOP {count}</button>)}</div><button onClick={chooseRandom} disabled={!ranked.length} className="mt-4 w-full rounded-xl bg-[#e8743b] py-3 font-black">랜덤으로 고르기</button>{winner && <div className="mt-5 rounded-2xl bg-[#fff3e9] p-5 text-center text-[#3a291d]"><p className="text-sm font-bold text-[#c85e2c]">오늘의 회식 메뉴</p><strong className="mt-1 block text-2xl">🎉 {winner.name}</strong><p className="mt-1 text-sm">현재 {winner.rank}위 · {winner.votes}표</p></div>}</div></aside></section></div></main>;
}
