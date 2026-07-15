"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Menu = { id: string; name: string; votes: number };
type RankedMenu = Menu & { rank: number };
type VoteState = { type?: string; room: string; hostId: string; you: string; participants: number; voters: number; menus: Menu[]; myVotes: string[] };
type Restaurant = { name: string; note: string };

const empty: VoteState = { room: "", hostId: "", you: "", participants: 0, voters: 0, menus: [], myVotes: [] };
const makeCode = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
const socketBase = () => (process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? (location.hostname === "localhost" ? "http://localhost:8080" : "https://wax-cracking-backend.onrender.com")).replace(/^http/, "ws");
const mapLink = (name: string) => `https://map.naver.com/p/search/${encodeURIComponent(name)}`;

const restaurantGuide: Record<string, Restaurant[]> = {
  "회·해산물": [
    { name: "범수산", note: "강남대로84길 · 회·해산물" },
  ],
  "장어·보양식": [
    { name: "화담장어 강남점", note: "사임당로 · 민물장어" },
  ],
  "족발·보쌈": [
    { name: "뽕족 강남역본점", note: "테헤란로4길 · 족발·막국수" },
  ],
  "삼겹살·돼지고기": [
    { name: "고깃집열", note: "강남역권 · 삼겹살·목살" },
    { name: "두껍삼 강남직영점", note: "서초대로78길 · 숙성 삼겹살" },
    { name: "신도세기 강남역점", note: "서초대로78길 · 돼지고기" },
    { name: "교대이층집 강남역점", note: "강남대로78길 · 꽃삼겹" },
    { name: "반갑다하대포 강남역점", note: "강남역권 · 숙성 돼지고기" },
    { name: "풍년참숯갈비 강남점", note: "서초대로74길 · 돼지갈비" },
    { name: "뼈탄집 강남역점", note: "강남역권 · 돼지고기" },
  ],
  "소고기·갈비": [
    { name: "더하누", note: "서초대로74길 · 한우·한식" },
    { name: "됐소 강남점", note: "강남역권 · 한우·한돈" },
    { name: "청기와타운 강남점", note: "강남대로78길 · 수원왕갈비" },
    { name: "우탭 강남점", note: "서초대로78길 · 숙성 한우" },
    { name: "도마3", note: "서초대로78길 · 한우 화로구이" },
  ],
  "양고기": [
    { name: "고메램 강남점", note: "강남역권 · 양고기" },
    { name: "한성양꼬치 강남2호점", note: "역삼로3길 · 양꼬치·지삼선" },
  ],
  "중식": [
    { name: "초선과여포", note: "서초대로78길 · 중식" },
    { name: "딘타이펑 강남역점", note: "서초대로73길 · 딤섬" },
    { name: "현화림 서초본점", note: "강남역권 · 중식" },
  ],
  "양식": [
    { name: "알렉스루카", note: "강남대로 · 모던 비스트로" },
    { name: "매드포갈릭 강남삼성타운점", note: "강남역 8번 출구권 · 파스타·피자" },
    { name: "더몰트하우스 강남역점", note: "서초대로73길 · 스테이크·파스타" },
  ],
  "한식주점·전골": [
    { name: "조양관한정식", note: "서초대로74길 · 한정식" },
    { name: "느린마을양조장&펍 강남점", note: "서초대로73길 · 막걸리·한식 안주" },
  ],
};

const secondStops: Restaurant[] = [
  { name: "이자카야나무 삼성타운점", note: "룸·단체 이용 가능 · 네이버 예약" },
  { name: "이자카야나무 강남역3호점", note: "전층 룸형 · 단체 모임에 적합" },
  { name: "이자카야나무 논현점", note: "신논현·논현권 · 단체석" },
  { name: "정글", note: "강남역 지오다노골목 · 단체석·예약 가능" },
  { name: "언더그라운드", note: "강남역권 · 맥주·펍 · 단체석 예약 가능" },
];
const secondStopsByDistrict: Record<string, Restaurant[]> = {
  gangnam11: [
    { name: "이자카야나무 CGV점", note: "강남역 11번 출구·신논현역 사이 · 이자카야" },
    { name: "정글", note: "강남역 지오다노골목 · 맥주·호프" },
    { name: "언더그라운드", note: "강남역권 · 맥주·펍" },
    { name: "생활맥주 강남역점", note: "수제맥주·치킨 · 가벼운 2차" },
    { name: "오늘와인한잔 강남우성점", note: "와인·하이볼 · 2개 층 좌석" },
  ],
  gangnam45: [
    { name: "이자카야나무 삼성타운점", note: "강남역 5번 출구권 · 룸형 이자카야" },
    { name: "이태원천상 강남역점", note: "강남역 6번 출구권 · 가림막 좌석 이자카야" },
    { name: "이자카야 센야 본점", note: "강남역 1~4번 출구권 · 숯불꼬치 이자카야" },
    { name: "생활맥주 강남역점", note: "수제맥주·치킨 · 가벼운 2차" },
    { name: "오늘와인한잔 강남우성점", note: "와인·하이볼 · 2개 층 좌석" },
  ],
  yeoksam: [
    { name: "이자카야나무 삼성타운점", note: "강남역 5번 출구권 · 룸형 이자카야" },
    { name: "이태원천상 강남역점", note: "강남역 6번 출구권 · 가림막 좌석 이자카야" },
    { name: "이자카야 센야 본점", note: "강남역 1~4번 출구권 · 숯불꼬치 이자카야" },
    { name: "생활맥주 강남역점", note: "수제맥주·치킨 · 가벼운 2차" },
    { name: "오늘와인한잔 강남우성점", note: "와인·하이볼 · 2개 층 좌석" },
  ],
};
const verifiedSecondStopsByDistrict: Record<string, Restaurant[]> = {
  gangnam11: [
    { name: "오늘와인한잔 강남우성점", note: "와인·하이볼" },
    { name: "생활맥주 강남역점", note: "수제맥주·치킨" },
    { name: "시선 강남점", note: "캐주얼 이자카야" },
  ],
  gangnam45: [
    { name: "이자카야나무 삼성타운점", note: "룸형 이자카야" },
    { name: "카이키 강남", note: "다이닝 사카바" },
    { name: "느린마을양조장&펍 강남점", note: "막걸리·한식 안주" },
  ],
  yeoksam: [
    { name: "카이키 강남", note: "다이닝 사카바" },
    { name: "생활맥주 강남역점", note: "수제맥주·치킨" },
    { name: "오늘와인한잔 강남우성점", note: "와인·하이볼" },
  ],
};
void secondStopsByDistrict;
const selectedDistrictByRestaurant: Record<string, string> = {
  "범수산": "gangnam11",
  "뽕족 강남역본점": "gangnam11",
  "화담장어 강남점": "yeoksam",
  "더하누": "gangnam45",
  "됐소 강남점": "gangnam45",
  "청기와타운 강남점": "gangnam45",
  "우탭 강남점": "gangnam45",
  "도마3": "gangnam45",
  "풍년참숯갈비 강남점": "gangnam45",
  "뼈탄집 강남역점": "gangnam45",
  "현화림 서초본점": "gangnam45",
};
const restaurantDistrict: Record<string, string> = {
  "양파이 강남점": "gangnam11", "고메램 강남점": "gangnam11", "세광양대창 강남역중앙점": "gangnam11", "차슈밍": "gangnam11", "가장맛있는족발 강남1호점": "gangnam11", "황해도 족발보쌈": "gangnam11", "족발야시장 신논현역점": "gangnam11", "중화객잔수 강남점": "gangnam11", "청기와타운": "gangnam45", "칸나 닭집": "gangnam45", "칸나칼국수&칸나닭집": "gangnam45", "잡어와묵은지": "gangnam45", "다미선": "gangnam45", "진스시": "gangnam45", "장서는날": "gangnam45", "이자카야나무 삼성타운점": "gangnam45", "창고43 강남점": "gangnam45", "진대감 강남역삼성타운점": "gangnam45", "도정육관 강남본점": "gangnam45", "한성양꼬치 강남2호점": "gangnam45", "양국": "yeoksam", "마노디셰프 강남점": "yeoksam", "일편등심 강남점": "yeoksam", "착한고기 강남역점": "yeoksam", "육랩 강남본점": "yeoksam", "강삼가든": "yeoksam", "육전식당 4호점": "yeoksam", "더막창스": "yeoksam", "청계숲양대창 강남직영점": "yeoksam", "어거스트힐 강남점": "yeoksam",
};
const officeWalkMinutes: Record<string, number> = {
  "잡어와묵은지": 5, "다미선": 6, "진스시": 7, "가장맛있는족발 강남1호점": 7, "황해도 족발보쌈": 8, "족발야시장 신논현역점": 9, "청기와타운": 4, "강삼가든": 8, "육전식당 4호점": 12, "일편등심 강남점": 10, "착한고기 강남역점": 8, "육랩 강남본점": 9, "창고43 강남점": 3, "진대감 강남역삼성타운점": 5, "도정육관 강남본점": 5, "양파이 강남점": 8, "고메램 강남점": 7, "양국": 12, "세광양대창 강남역중앙점": 8, "더막창스": 10, "청계숲양대창 강남직영점": 6, "칸나 닭집": 4, "칸나칼국수&칸나닭집": 4, "중화객잔수 강남점": 8, "차슈밍": 8, "마노디셰프 강남점": 11, "어거스트힐 강남점": 7, "장서는날": 7, "이자카야나무 삼성타운점": 3,
};
void officeWalkMinutes;
Object.values(restaurantGuide).flat().forEach((restaurant) => {
  restaurant.note += " · 인포텍코퍼레이션 출발 경로는 지도에서 확인";
});

export default function DinnerVotePage() {
  const [code, setCode] = useState("");
  const [room, setRoom] = useState("");
  const [state, setState] = useState(empty);
  const [picked, setPicked] = useState<string[]>([]);
  const [newMenu, setNewMenu] = useState("");
  const [topCount, setTopCount] = useState(3);
  const [winner, setWinner] = useState<RankedMenu | null>(null);
  const [selectedRestaurant, setSelectedRestaurantState] = useState<Restaurant | null>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const sharedRoom = new URLSearchParams(window.location.search).get("room")?.toUpperCase().trim();
    if (!sharedRoom) return;
    const frame = window.requestAnimationFrame(() => setRoom(sharedRoom));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!room) return;
    const socket = new WebSocket(`${socketBase()}/ws/dinner-vote?room=${room}`);
    ws.current = socket;
    socket.onmessage = (event) => {
      const next = JSON.parse(event.data) as VoteState;
      if (next.type === "state") { setState(next); setPicked(next.myVotes); }
    };
    return () => socket.close();
  }, [room]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dinner-vote-page");
    root.classList.toggle("dinner-vote-submitted", state.myVotes.length === 2);
    return () => root.classList.remove("dinner-vote-page", "dinner-vote-submitted");
  }, [state.myVotes]);

  useEffect(() => {
    if (!room) return;
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set("room", room);
    window.history.replaceState(null, "", shareUrl);

    const nav = document.querySelector("main nav");
    const shareButton = document.createElement("button");
    shareButton.type = "button";
    shareButton.textContent = "방 링크 공유";
    shareButton.className = "dinner-vote-share rounded-xl bg-[#e8743b] px-4 py-2.5 text-sm font-black text-white";
    shareButton.onclick = async () => {
      try {
        if (navigator.share) await navigator.share({ title: "회식 메뉴 익명 투표", url: shareUrl.toString() });
        else {
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(shareUrl.toString());
            shareButton.textContent = "링크 복사 완료";
            window.setTimeout(() => { shareButton.textContent = "방 링크 공유"; }, 1600);
          } else window.prompt("아래 링크를 복사해 팀원에게 보내세요.", shareUrl.toString());
        }
      } catch { /* Sharing can be cancelled without affecting the vote. */ }
    };
    nav?.appendChild(shareButton);
    return () => shareButton.remove();
  }, [room]);

  const isHost = state.you === state.hostId;
  const canVote = picked.length === 2;
  const hasSubmitted = state.myVotes.length === 2;
  const ranked = useMemo(() => state.menus.map((menu, index) => ({ ...menu, rank: index + 1 })), [state.menus]);
  const recommendations = winner ? restaurantGuide[winner.name] ?? [] : [];
  function setSelectedRestaurant(restaurant: Restaurant | null) {
    if (restaurant) {
      const district = selectedDistrictByRestaurant[restaurant.name] ?? restaurantDistrict[restaurant.name] ?? "gangnam45";
      secondStops.splice(0, secondStops.length, ...verifiedSecondStopsByDistrict[district].map((place) => ({ ...place, note: `${place.note} · ${restaurant.name} 출발 경로는 지도에서 확인` })));
    }
    setSelectedRestaurantState(restaurant);
  }

  function toggle(id: string) {
    setWinner(null); setSelectedRestaurant(null);
    setPicked(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 2 ? [...current, id] : current);
  }
  function submitVote() { if (canVote) ws.current?.send(JSON.stringify({ type: "vote", menuIds: picked })); }
  function chooseRandom() {
    if (!hasSubmitted) return;
    const candidates = ranked.slice(0, Math.min(topCount, ranked.length));
    if (!candidates.length) return;
    setWinner(candidates[Math.floor(Math.random() * candidates.length)]);
    setSelectedRestaurant(null);
  }

  if (!room) return <main className="min-h-screen bg-[#fff8ef] px-4 py-8 text-[#24201b]"><div className="mx-auto max-w-2xl"><Link href="/" className="text-sm font-bold text-[#8a6c54]">← 홈으로</Link><section className="mt-12 rounded-[2rem] border border-[#f0d8bd] bg-white p-8 shadow-xl shadow-orange-100"><p className="font-black tracking-[.24em] text-[#e8743b]">TEAM DINNER</p><h1 className="mt-3 text-4xl font-black">오늘 회식, 뭘 먹을까?</h1><p className="mt-3 text-[#78695d]">이름 없이 입장해 먹고 싶은 음식 종류 2개를 익명 투표하세요.</p><div className="mt-8 flex flex-wrap gap-3"><button onClick={() => setRoom(makeCode())} className="rounded-xl bg-[#e8743b] px-5 py-3 font-black text-white">새 익명 투표방 만들기</button><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="방 코드" className="w-32 rounded-xl border border-[#ead7c5] px-3 font-bold" /><button disabled={!code.trim()} onClick={() => setRoom(code)} className="rounded-xl border border-[#e8743b] px-5 font-black text-[#c85e2c] disabled:opacity-40">익명 입장</button></div></section></div></main>;

  return <main className="min-h-screen bg-[#fff8ef] px-4 py-7 text-[#24201b]"><div className="mx-auto max-w-5xl"><nav className="flex items-center justify-between"><Link href="/" className="text-sm font-bold text-[#8a6c54]">← 홈으로</Link><span className="rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm">방 코드 <b className="ml-2 tracking-[.18em] text-[#e8743b]">{state.room}</b></span></nav><header className="mt-10 flex flex-wrap items-end justify-between gap-4"><div><p className="font-black tracking-[.24em] text-[#e8743b]">DINNER VOTE</p><h1 className="mt-2 text-4xl font-black">먹고 싶은 음식 종류 2개를 골라요</h1><p className="mt-2 text-[#78695d]">투표 완료 {state.voters}명 · 참여 중 {state.participants}명 · 최종 종류가 정해지면 예약 가능한 단체 식당을 고릅니다.</p></div><span className={`rounded-xl px-4 py-3 text-sm font-black ${canVote ? "bg-[#dbf2df] text-[#27743b]" : "bg-[#fff0d8] text-[#a9651c]"}`}>{canVote ? "2개 선택 완료" : `${picked.length}/2 선택`}</span></header><section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_.95fr]"><div className="rounded-[2rem] border border-[#f0d8bd] bg-white p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-black">음식 종류 투표</h2><button disabled={!canVote} onClick={submitVote} className="rounded-xl bg-[#24201b] px-4 py-2.5 text-sm font-black text-white disabled:opacity-35">내 투표 제출</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{state.menus.map(menu => <button key={menu.id} onClick={() => toggle(menu.id)} className={`rounded-2xl border p-4 text-left transition ${picked.includes(menu.id) ? "border-[#e8743b] bg-[#fff1e8] ring-2 ring-[#e8743b]/20" : "border-[#eee1d5] hover:border-[#efb18b]"}`}><span className="text-2xl">{picked.includes(menu.id) ? "✓" : "🍽️"}</span><strong className="mt-3 block text-lg">{menu.name}</strong><span className="mt-1 block text-sm text-[#8a796b]">{menu.votes}표</span></button>)}</div>{isHost && <form onSubmit={e => { e.preventDefault(); if (newMenu.trim()) { ws.current?.send(JSON.stringify({ type: "addMenu", name: newMenu })); setNewMenu(""); } }} className="mt-5 flex gap-2"><input value={newMenu} onChange={e => setNewMenu(e.target.value)} maxLength={24} placeholder="음식 종류 직접 추가" className="min-w-0 flex-1 rounded-xl border border-[#ead7c5] px-4 py-3"/><button className="rounded-xl border border-[#e8743b] px-4 font-black text-[#c85e2c]">추가</button></form>}</div><aside className="rounded-[2rem] bg-[#24201b] p-6 text-white"><h2 className="text-xl font-black">현재 순위</h2><ol className="mt-5 space-y-3">{ranked.map(menu => <li key={menu.id} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3"><b className="w-7 text-xl text-[#ffc972]">{menu.rank}</b><span className="flex-1 font-bold">{menu.name}</span><strong>{menu.votes}표</strong></li>)}</ol><div className="mt-8 border-t border-white/15 pt-6"><p className="text-sm font-bold text-[#d6cac0]">상위 음식 종류 중 랜덤 선택</p><div className="mt-3 flex gap-2">{[1,2,3].map(count => <button key={count} onClick={() => { setTopCount(count); setWinner(null); setSelectedRestaurant(null); }} className={`rounded-lg px-3 py-2 text-sm font-black ${topCount === count ? "bg-[#ffc972] text-[#36230e]" : "bg-white/10"}`}>TOP {count}</button>)}</div><button onClick={chooseRandom} disabled={!ranked.length} className="mt-4 w-full rounded-xl bg-[#e8743b] py-3 font-black">랜덤으로 고르기</button></div></aside></section>{winner && <section className="mt-6 rounded-[2rem] border border-[#f0d8bd] bg-white p-6"><p className="text-sm font-black tracking-[.18em] text-[#e8743b]">RESULT</p><h2 className="mt-2 text-3xl font-black">🎉 {winner.name} 회식 후보</h2><p className="mt-2 text-[#78695d]">예약 가능한 단체 식당을 골라 주세요. 예약 가능 시간과 단체석은 네이버 지도에서 최종 확인합니다.</p><div className="mt-5 grid gap-3 md:grid-cols-2">{recommendations.map(restaurant => <article key={restaurant.name} className={`rounded-2xl border p-5 ${selectedRestaurant?.name === restaurant.name ? "border-[#e8743b] bg-[#fff1e8]" : "border-[#ead7c5]"}`}><h3 className="text-lg font-black">{restaurant.name}</h3><p className="mt-2 text-sm leading-6 text-[#78695d]">{restaurant.note}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setSelectedRestaurant(restaurant)} className="rounded-lg bg-[#24201b] px-3 py-2 text-sm font-black text-white">이 식당 선택</button><a href={mapLink(restaurant.name)} target="_blank" rel="noreferrer" className="rounded-lg border border-[#e8743b] px-3 py-2 text-sm font-black text-[#c85e2c]">네이버 지도·예약</a></div></article>)}</div>{selectedRestaurant && <div className="mt-6 rounded-2xl bg-[#24201b] p-5 text-white"><p className="text-sm font-black tracking-[.18em] text-[#ffc972]">2ND STOP</p><h3 className="mt-2 text-2xl font-black">{selectedRestaurant.name} 후 2차 후보</h3><p className="mt-1 text-sm text-[#d6cac0]">2차는 예약 없이 방문해도 됩니다. 인원·시간에 맞는 곳을 골라 보세요.</p><div className="mt-5 grid gap-3 md:grid-cols-2">{secondStops.map(place => <article key={place.name} className="rounded-xl bg-white/10 p-4"><strong>{place.name}</strong><p className="mt-1 text-sm text-[#d6cac0]">{place.note}</p><a href={mapLink(place.name)} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-white px-3 py-2 text-xs font-black text-[#34261d]">네이버 지도 보기</a></article>)}</div></div>}</section>}</div></main>;
}
