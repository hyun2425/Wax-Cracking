"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Quiz = {
  id: string;
  category: string;
  answer: string;
  hint?: string;
  custom?: boolean;
};

type RoomState = {
  room: string; hostId: string; you: string; category: string; categories: string[]; round: number; solved: boolean; hintVisible: boolean;
  initials?: string; questionCategory?: string; hint?: string; answer?: string; players: { id: string; name: string; score: number }[];
};

const emptyRoom: RoomState = { room: "", hostId: "", you: "", category: "전체", categories: [], round: 0, solved: false, hintVisible: false, players: [] };
const socketBase = () => (process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? (location.hostname === "localhost" ? "http://localhost:8080" : "https://wax-cracking-backend.onrender.com")).replace(/^http/, "ws");
const makeRoomCode = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

const STORAGE_KEY = "wax-cracking-initial-quiz-custom";
const builtInQuizzes: Quiz[] = [
  { id: "food-1", category: "음식", answer: "김치찌개", hint: "얼큰한 한국의 대표 찌개" },
  { id: "food-2", category: "음식", answer: "떡볶이", hint: "매콤달콤한 분식" },
  { id: "food-3", category: "음식", answer: "삼겹살", hint: "구워 먹는 돼지고기" },
  { id: "ent-1", category: "연예", answer: "아이유", hint: "가수이자 배우" },
  { id: "ent-2", category: "연예", answer: "유재석", hint: "국민 MC" },
  { id: "ent-3", category: "연예", answer: "블랙핑크", hint: "4인조 걸그룹" },
  { id: "place-1", category: "장소", answer: "경복궁", hint: "서울의 대표 궁궐" },
  { id: "place-2", category: "장소", answer: "한강공원", hint: "치킨과 라면이 떠오르는 곳" },
  { id: "place-3", category: "장소", answer: "제주도", hint: "한라산이 있는 섬" },
  { id: "animal-1", category: "동물", answer: "코끼리", hint: "긴 코를 가진 동물" },
  { id: "animal-2", category: "동물", answer: "펭귄", hint: "남극의 새" },
  { id: "animal-3", category: "동물", answer: "고슴도치", hint: "가시가 있는 작은 동물" },
];

const choseongMap = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

function toChoseong(value: string) {
  return Array.from(value)
    .map((character) => {
      const code = character.charCodeAt(0) - 0xac00;
      return code >= 0 && code <= 11171 ? choseongMap[Math.floor(code / 588)] : character;
    })
    .join(" ");
}

function normalize(value: string) {
  return value.replace(/\s/g, "").toLocaleLowerCase();
}

export default function InitialQuizPage() {
  const [customQuizzes, setCustomQuizzes] = useState<Quiz[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? (JSON.parse(stored) as Quiz[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      return [];
    }
  });
  const [category, setCategory] = useState("전체");
  const [quizIndex, setQuizIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [newCategory, setNewCategory] = useState("음식");
  const [newAnswer, setNewAnswer] = useState("");
  const [newHint, setNewHint] = useState("");
  const [hintOpened, setHintOpened] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [roomDraft, setRoomDraft] = useState("");
  const [nickname, setNickname] = useState("");
  const [roomState, setRoomState] = useState<RoomState>(emptyRoom);
  const [roomAnswer, setRoomAnswer] = useState("");
  const [connected, setConnected] = useState(false);
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    const nextSocket = new WebSocket(`${socketBase()}/ws/initial-quiz?room=${roomCode}`);
    socket.current = nextSocket;
    nextSocket.onopen = () => { setConnected(true); nextSocket.send(JSON.stringify({ type: "profile", value: nickname || "플레이어" })); };
    nextSocket.onclose = () => setConnected(false);
    nextSocket.onmessage = (event) => { const data = JSON.parse(event.data) as RoomState & { type: string }; if (data.type === "state") setRoomState(data); };
    return () => nextSocket.close();
  }, [roomCode, nickname]);

  const categories = useMemo(
    () => ["전체", ...Array.from(new Set([...builtInQuizzes, ...customQuizzes].map((quiz) => quiz.category)))],
    [customQuizzes],
  );
  const quizzes = useMemo(
    () => (category === "전체" ? [...builtInQuizzes, ...customQuizzes] : [...builtInQuizzes, ...customQuizzes].filter((quiz) => quiz.category === category)),
    [category, customQuizzes],
  );
  const currentQuiz = quizzes[quizIndex % Math.max(quizzes.length, 1)];

  function resetRound() {
    setAnswer("");
    setResult("idle");
    setShowAnswer(false);
    setHintOpened(false);
  }

  function sendRoom(type: string, value = "") {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type, value }));
  }

  function joinRoom(code: string) {
    const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    if (nickname.trim() && normalized) { setRoomCode(normalized); setRoomState(emptyRoom); setRoomAnswer(""); }
  }

  function submitRoomAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roomAnswer.trim()) return;
    sendRoom("guess", roomAnswer);
    setRoomAnswer("");
  }

  function changeCategory(nextCategory: string) {
    setCategory(nextCategory);
    setQuizIndex(0);
    resetRound();
  }

  function nextQuiz() {
    setQuizIndex((current) => (quizzes.length > 1 ? (current + 1) % quizzes.length : 0));
    resetRound();
  }

  function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentQuiz || !answer.trim()) return;
    const isCorrect = normalize(answer) === normalize(currentQuiz.answer);
    setResult(isCorrect ? "correct" : "wrong");
    if (isCorrect) setScore((current) => current + 1);
  }

  function addQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanAnswer = newAnswer.trim();
    const cleanCategory = newCategory.trim();
    if (!cleanAnswer || !cleanCategory) return;
    const nextQuiz: Quiz = { id: crypto.randomUUID(), category: cleanCategory, answer: cleanAnswer, hint: newHint.trim(), custom: true };
    const next = [...customQuizzes, nextQuiz];
    setCustomQuizzes(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setNewAnswer("");
    setNewHint("");
    setCategory(cleanCategory);
    setQuizIndex(Math.max(0, next.filter((quiz) => quiz.category === cleanCategory).length - 1));
    resetRound();
  }

  function removeCustomQuiz(id: string) {
    const next = customQuizzes.filter((quiz) => quiz.id !== id);
    setCustomQuizzes(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setQuizIndex(0);
    resetRound();
  }

  return (
    <main className="min-h-screen bg-[#fffaf3] text-[#241a14]">
      <div className="mx-auto w-[min(1100px,calc(100%-32px))] py-8 sm:py-12">
        <nav className="mb-10 flex items-center justify-between">
          <Link className="text-sm font-extrabold text-[#806a5b] hover:text-[#d46337]" href="/">← 홈으로</Link>
          <span className="rounded-full bg-[#fff0e6] px-4 py-2 text-sm font-black text-[#c75428]">맞힌 문제 {score}개</span>
        </nav>
        <header className="mb-8 max-w-2xl">
          <p className="mb-3 text-xs font-black tracking-[.25em] text-[#d46337]">KOREAN INITIAL QUIZ</p>
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">초성 퀴즈</h1>
          <p className="mt-4 text-base leading-7 text-[#806a5b]">카테고리를 골라 풀고, 우리만의 문제도 직접 출제해 보세요.</p>
        </header>

        <section className="mb-7 rounded-[28px] border border-[#e6c9b6] bg-[#2b211b] p-5 text-white shadow-[0_18px_45px_rgba(123,71,39,0.12)] sm:p-7">
          {!roomCode ? <div className="grid gap-4 md:grid-cols-[1fr_auto]"><div><p className="text-xs font-black tracking-[.2em] text-[#f5b184]">MULTIPLAYER</p><h2 className="mt-2 text-2xl font-black">친구와 함께 풀기</h2><p className="mt-2 text-sm text-white/65">방 코드를 공유하면 같은 초성 문제를 누가 먼저 맞히는지 겨룰 수 있어요.</p><input className="mt-4 w-full max-w-sm rounded-xl border border-white/15 bg-white/10 px-4 py-3 font-bold outline-none" maxLength={16} onChange={(event) => setNickname(event.target.value)} placeholder="내 닉네임" value={nickname} /></div><div className="flex flex-col justify-center gap-2"><button className="rounded-xl bg-[#f6a26e] px-5 py-3 font-black text-[#2b211b] disabled:opacity-40" disabled={!nickname.trim()} onClick={() => joinRoom(makeRoomCode())} type="button">방 만들기</button><div className="flex gap-2"><input className="w-32 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold outline-none" onChange={(event) => setRoomDraft(event.target.value)} placeholder="방 코드" value={roomDraft} /><button className="rounded-xl border border-white/20 px-4 text-sm font-bold disabled:opacity-40" disabled={!nickname.trim() || !roomDraft.trim()} onClick={() => joinRoom(roomDraft)} type="button">입장</button></div></div></div> : <div><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black tracking-[.2em] text-[#f5b184]">MULTIPLAYER ROOM</p><h2 className="mt-1 text-2xl font-black">방 코드 <span className="ml-2 tracking-[.22em] text-[#f6a26e]">{roomCode}</span></h2></div><span className="text-sm font-bold text-white/65">{connected ? "실시간 연결됨" : "연결 중..."}</span></div><div className="mt-5 grid gap-4 lg:grid-cols-[1fr_220px]"><div className="rounded-2xl bg-white/10 p-5 text-center"><div className="flex flex-wrap justify-center gap-2">{roomState.categories.map((item) => <button className={`rounded-full px-3 py-1.5 text-xs font-black ${roomState.category === item ? "bg-[#f6a26e] text-[#2b211b]" : "bg-white/10"}`} disabled={roomState.you !== roomState.hostId} key={item} onClick={() => sendRoom("category", item)} type="button">{item}</button>)}</div>{roomState.initials ? <><p className="mt-5 text-xs font-bold text-white/60">{roomState.questionCategory} · {roomState.round}번째 문제</p><p className="mt-3 text-3xl font-black tracking-[.2em] text-[#f6a26e] sm:text-5xl">{roomState.initials}</p>{roomState.hintVisible && <p className="mt-3 text-sm font-bold text-white/75">힌트: {roomState.hint}</p>}{roomState.solved && <p className="mt-3 text-xl font-black text-emerald-300">정답: {roomState.answer}</p>}<form className="mt-5 flex gap-2" onSubmit={submitRoomAnswer}><input className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 font-bold text-[#2b211b]" disabled={roomState.solved} onChange={(event) => setRoomAnswer(event.target.value)} placeholder="정답 입력" value={roomAnswer} /><button className="rounded-xl bg-[#f6a26e] px-4 font-black text-[#2b211b]">확인</button></form></> : <p className="py-8 text-sm font-bold text-white/60">방장이 게임 시작을 기다리고 있어요.</p>} {roomState.you === roomState.hostId && <div className="mt-4 flex justify-center gap-2"><button className="rounded-xl border border-white/25 px-3 py-2 text-xs font-bold" disabled={!roomState.initials || roomState.solved} onClick={() => sendRoom("hint")} type="button">힌트 공개</button><button className="rounded-xl bg-[#f6a26e] px-3 py-2 text-xs font-black text-[#2b211b]" onClick={() => sendRoom(roomState.initials ? "next" : "start")} type="button">{roomState.initials ? "다음 문제" : "게임 시작"}</button></div>}</div><aside className="rounded-2xl bg-white/10 p-4"><p className="text-xs font-black tracking-widest text-white/60">순위</p><div className="mt-3 space-y-2">{roomState.players.map((player, index) => <div className="flex justify-between rounded-lg bg-black/10 px-3 py-2 text-sm" key={player.id}><span>{index + 1}. {player.name}</span><b>{player.score}</b></div>)}</div></aside></div></div>}
        </section>

        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-[28px] border border-[#f0d8c7] bg-white p-5 shadow-[0_18px_45px_rgba(123,71,39,0.09)] sm:p-8">
            <div className="flex flex-wrap gap-2" aria-label="카테고리 선택">
              {categories.map((item) => <button key={item} onClick={() => changeCategory(item)} className={`rounded-full px-4 py-2 text-sm font-extrabold transition ${category === item ? "bg-[#d46337] text-white" : "bg-[#fff4ec] text-[#89593f] hover:bg-[#ffe5d4]"}`} type="button">{item}</button>)}
            </div>
            {currentQuiz ? <>
              <div className="mt-10 text-center">
                <p className="text-sm font-bold text-[#a47f6b]">{currentQuiz.category}{currentQuiz.custom ? " · 내가 만든 문제" : ""}</p>
                <div className="my-5 rounded-3xl bg-[#fff7f0] px-4 py-9 text-4xl font-black tracking-[.22em] text-[#d46337] sm:text-6xl">{toChoseong(currentQuiz.answer)}</div>
                {hintOpened ? <p className="min-h-6 text-sm font-bold text-[#806a5b]">힌트: {currentQuiz.hint || "없음"}</p> : <button className="min-h-6 text-sm font-bold text-[#a47f6b] underline underline-offset-4" onClick={() => setHintOpened(true)} type="button">힌트 보기</button>}
              </div>
              <form onSubmit={submitAnswer} className="mt-7 flex gap-2">
                <input autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-[#ecd5c5] px-4 py-3 font-bold outline-none focus:border-[#d46337]" disabled={showAnswer || result === "correct"} onChange={(event) => setAnswer(event.target.value)} placeholder="정답을 입력하세요" value={answer} />
                <button className="rounded-xl bg-[#2b211b] px-5 font-black text-white disabled:opacity-40" disabled={!answer.trim() || showAnswer || result === "correct"}>확인</button>
              </form>
              <div className="mt-3 min-h-6 text-center text-sm font-extrabold">{result === "correct" && <span className="text-emerald-600">정답이에요! 🎉</span>}{result === "wrong" && <span className="text-rose-600">아쉬워요, 다시 입력해 보세요.</span>}{showAnswer && <span className="text-[#d46337]">정답: {currentQuiz.answer}</span>}</div>
              <div className="mt-6 flex justify-center gap-2"><button className="rounded-xl border border-[#e9cdbb] px-4 py-3 text-sm font-extrabold text-[#80553e]" onClick={() => setShowAnswer(true)} type="button">정답 보기</button><button className="rounded-xl bg-[#d46337] px-4 py-3 text-sm font-black text-white" onClick={nextQuiz} type="button">다음 문제 →</button></div>
            </> : <p className="py-16 text-center font-bold text-[#806a5b]">이 카테고리에는 아직 문제가 없어요. 직접 출제해 보세요!</p>}
          </section>

          <aside className="rounded-[28px] border border-[#f0d8c7] bg-[#2b211b] p-6 text-white">
            <p className="text-xs font-black tracking-[.2em] text-[#f5b184]">MAKE A QUIZ</p>
            <h2 className="mt-2 text-2xl font-black">직접 출제하기</h2>
            <form className="mt-6 space-y-4" onSubmit={addQuiz}>
              <label className="block text-sm font-bold">카테고리<input className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 font-bold outline-none" maxLength={16} onChange={(event) => setNewCategory(event.target.value)} value={newCategory} /></label>
              <label className="block text-sm font-bold">정답<input className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 font-bold outline-none" maxLength={30} onChange={(event) => setNewAnswer(event.target.value)} placeholder="예: 마라탕" value={newAnswer} /></label>
              <label className="block text-sm font-bold">힌트 <span className="font-medium text-white/50">(선택)</span><input className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 font-bold outline-none" maxLength={60} onChange={(event) => setNewHint(event.target.value)} placeholder="매운 중국식 음식" value={newHint} /></label>
              <button className="w-full rounded-xl bg-[#f6a26e] py-3 font-black text-[#2b211b]" disabled={!newAnswer.trim() || !newCategory.trim()}>문제 추가</button>
            </form>
            {customQuizzes.length > 0 && <div className="mt-8 border-t border-white/15 pt-5"><p className="text-sm font-black">내가 만든 문제 ({customQuizzes.length})</p><ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">{customQuizzes.map((quiz) => <li className="flex items-center justify-between gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm" key={quiz.id}><span className="truncate">[{quiz.category}] {toChoseong(quiz.answer)}</span><button aria-label={`${quiz.answer} 삭제`} className="shrink-0 text-[#f5b184]" onClick={() => removeCustomQuiz(quiz.id)} type="button">삭제</button></li>)}</ul></div>}
          </aside>
        </div>
      </div>
    </main>
  );
}
