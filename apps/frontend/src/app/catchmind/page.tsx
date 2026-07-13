"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ConnectionState = "idle" | "connecting" | "open" | "closed";
type GameMode = "classic" | "liar";
type Phase =
  | "lobby"
  | "choosing"
  | "drawing"
  | "revealed"
  | "betweenGames"
  | "finished"
  | "liarDrawing"
  | "voting"
  | "liarRevealed";

type Point = {
  x: number;
  y: number;
};

type Stroke = {
  color: string;
  points: Point[];
  size: number;
  type: "draw";
};

type Player = {
  id: string;
  nickname: string;
  score: number;
};

type GameState = {
  category: string;
  correctPlayerIds: string[];
  drawerId: string;
  drawerName: string;
  hostId: string;
  isLiar: boolean;
  liarName?: string;
  mode: GameMode;
  phase: Phase;
  players: Player[];
  room: string;
  roundEndsAt: number;
  round: number;
  status: string;
  strokes: Stroke[];
  turnEndsAt: number;
  turnOrder: string[];
  myVote: string;
  votesCast: number;
  voteCounts?: Record<string, number>;
  winnerTeam: string;
  word: string;
  wordCandidates: string[];
  you: string;
};

type ChatMessage = {
  id: string;
  message: string;
  sender: string;
  sentAt: number;
  system?: boolean;
};

type ServerMessage =
  | (GameState & { type: "state" })
  | Stroke
  | { type: "clear" }
  | { message: string; type: "notice" }
  | { message: string; sender: string; sentAt: number; type: "chat" };

const localApiBaseUrl = "http://localhost:8080";
const deployedApiBaseUrl = "https://wax-cracking-backend.onrender.com";
const colors = ["#111827", "#ef4444", "#2563eb", "#16a34a", "#f59e0b", "#a855f7"];

function makeInviteCode() {
  const words = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => words[Math.floor(Math.random() * words.length)]).join("");
}

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

function getApiBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return localApiBaseUrl;
    }
  }

  return deployedApiBaseUrl;
}

function getSocketUrl(roomCode: string) {
  const socketBaseUrl = getApiBaseUrl().replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  return `${socketBaseUrl}/ws/catchmind?room=${encodeURIComponent(roomCode)}`;
}

function getInitialRoomCode() {
  if (typeof window === "undefined") {
    return "";
  }

  return normalizeCode(new URLSearchParams(window.location.search).get("room") ?? "");
}

function getInitialNickname() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem("catchMindNickname") ?? "";
}

function initialGame(room = ""): GameState {
  return {
    category: "",
    correctPlayerIds: [],
    drawerId: "",
    drawerName: "",
    hostId: "",
    isLiar: false,
    mode: "classic",
    phase: "lobby",
    players: [],
    room,
    roundEndsAt: 0,
    round: 0,
    status: "방을 만들거나 초대 코드를 입력하세요.",
    strokes: [],
    turnEndsAt: 0,
    turnOrder: [],
    myVote: "",
    votesCast: 0,
    voteCounts: {},
    winnerTeam: "",
    word: "",
    wordCandidates: [],
    you: "",
  };
}

function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length < 2) {
    return;
  }

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = stroke.color;
  context.lineWidth = stroke.size;
  context.beginPath();
  context.moveTo(stroke.points[0].x, stroke.points[0].y);
  stroke.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.stroke();
  context.restore();
}

export default function CatchMindPage() {
  const initialRoomCode = useMemo(() => getInitialRoomCode(), []);
  const [draftCode, setDraftCode] = useState(initialRoomCode);
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState(getInitialNickname);
  const [mode, setMode] = useState<GameMode>("classic");
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [game, setGame] = useState<GameState>(() => initialGame(initialRoomCode));
  const [notice, setNotice] = useState("닉네임을 정하고 방에 입장하세요.");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [guessDraft, setGuessDraft] = useState("");
  const [brushColor, setBrushColor] = useState(colors[0]);
  const [brushSize, setBrushSize] = useState(6);
  const [reconnectKey, setReconnectKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [dismissedScoreStamp, setDismissedScoreStamp] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const drawingRef = useRef(false);
  const activeStrokeRef = useRef<Point[]>([]);
  const gameRef = useRef(game);
  const nicknameRef = useRef(nickname);

  const isConnected = connection === "open";
  const isDrawer = game.you !== "" && game.drawerId === game.you;
  const isHost = game.you !== "" && game.hostId === game.you;
  const hasGuessedCorrect = game.correctPlayerIds.includes(game.you);
  const isLiarMode = game.mode === "liar";
  const canDraw =
    isConnected &&
    ((game.phase === "drawing" && isDrawer) || (game.phase === "liarDrawing" && isDrawer));
  const canGuess = isConnected && game.phase === "drawing" && !isDrawer && !hasGuessedCorrect;
  const remainingSeconds =
    game.roundEndsAt > 0 ? Math.max(0, Math.ceil((game.roundEndsAt - now) / 1000)) : 0;
  const turnRemainingSeconds =
    game.turnEndsAt > 0 ? Math.max(0, Math.ceil((game.turnEndsAt - now) / 1000)) : 0;
  const ranking = useMemo(
    () => [...game.players].sort((left, right) => right.score - left.score || left.nickname.localeCompare(right.nickname)),
    [game.players],
  );
  const scoreStamp = `${game.phase}:${ranking.map((player) => `${player.id}-${player.score}`).join("|")}`;
  const showScoreDialog = game.phase === "finished" && ranking.length > 0 && dismissedScoreStamp !== scoreStamp;
  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined" || !roomCode) {
      return "";
    }

    const url = new URL(window.location.href);
    url.searchParams.set("room", roomCode);
    return url.toString();
  }, [roomCode]);

  const redrawCanvas = useCallback((strokes: Stroke[]) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#fffdf8";
    context.fillRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((stroke) => drawStroke(context, stroke));
  }, []);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    nicknameRef.current = nickname;
    if (nickname.trim()) {
      window.localStorage.setItem("catchMindNickname", nickname.trim());
    }
  }, [nickname]);

  useEffect(() => {
    redrawCanvas(game.strokes);
  }, [game.strokes, redrawCanvas]);

  useEffect(() => {
    if (game.roundEndsAt <= 0 && game.turnEndsAt <= 0) {
      return;
    }

    const timerId = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timerId);
  }, [game.roundEndsAt, game.turnEndsAt]);

  const sendMessage = useCallback((message: object) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setNotice("아직 서버에 연결되지 않았습니다.");
      return;
    }

    socket.send(JSON.stringify(message));
  }, []);

  useEffect(() => {
    if (!roomCode) {
      return;
    }

    const socket = new WebSocket(getSocketUrl(roomCode));
    socketRef.current = socket;

    socket.onopen = () => {
      setConnection("open");
      setNotice("방에 연결되었습니다.");
      socket.send(JSON.stringify({ nickname: nicknameRef.current.trim() || "익명", type: "profile" }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;

      if (message.type === "state") {
        setGame(message);
        setMode(message.mode);
        return;
      }

      if (message.type === "draw") {
        setGame((current) => ({
          ...current,
          strokes: [...current.strokes, message].slice(-900),
        }));
        return;
      }

      if (message.type === "clear") {
        setGame((current) => ({ ...current, strokes: [] }));
        redrawCanvas([]);
        return;
      }

      if (message.type === "notice") {
        setNotice(message.message);
        setChatMessages((current) => [
          ...current.slice(-79),
          {
            id: `notice-${Date.now()}-${current.length}`,
            message: message.message,
            sender: "시스템",
            sentAt: Date.now(),
            system: true,
          },
        ]);
        return;
      }

      setChatMessages((current) => [
        ...current.slice(-79),
        {
          id: `${message.sentAt}-${current.length}`,
          message: message.message,
          sender: message.sender,
          sentAt: message.sentAt,
        },
      ]);
    };

    socket.onerror = () => {
      setConnection("closed");
      setNotice(`백엔드 서버(${getApiBaseUrl()}) 연결을 확인하세요.`);
    };

    socket.onclose = () => {
      setConnection("closed");
      setNotice((current) => current || "방 연결이 종료되었습니다.");
    };

    return () => socket.close();
  }, [reconnectKey, redrawCanvas, roomCode]);

  useEffect(() => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ nickname: nickname.trim() || "익명", type: "profile" }));
    }
  }, [nickname]);

  function joinRoom(code: string) {
    const nextCode = normalizeCode(code);
    if (!nextCode) {
      setNotice("초대 코드를 입력하세요.");
      return;
    }

    setDraftCode(nextCode);
    setRoomCode(nextCode);
    setChatMessages([]);
    setGame(initialGame(nextCode));
    setReconnectKey((current) => current + 1);

    const url = new URL(window.location.href);
    url.searchParams.set("room", nextCode);
    window.history.replaceState(null, "", url.toString());
  }

  function createRoom() {
    joinRoom(makeInviteCode());
  }

  function startRound(nextMode = mode) {
    sendMessage({ mode: nextMode, type: "start" });
  }

  function continueGame() {
    sendMessage({ type: "continueGame" });
  }

  function endGame() {
    sendMessage({ type: "endGame" });
  }

  function selectWord(index: number) {
    sendMessage({ index, type: "selectWord" });
  }

  function clearCanvas() {
    sendMessage({ type: "clear" });
  }

  function revealAnswer() {
    sendMessage({ type: "reveal" });
  }

  function vote(targetId: string) {
    sendMessage({ targetId, type: "vote" });
  }

  async function copyInviteUrl() {
    if (!inviteUrl) {
      setNotice("먼저 방을 만들어 주세요.");
      return;
    }

    await navigator.clipboard.writeText(inviteUrl);
    setNotice("초대 링크를 복사했습니다.");
  }

  function canvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function beginDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    activeStrokeRef.current = [canvasPoint(event)];
  }

  function moveDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !canDraw) {
      return;
    }

    const point = canvasPoint(event);
    const previous = activeStrokeRef.current.at(-1);
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) < 2) {
      return;
    }

    activeStrokeRef.current = [...activeStrokeRef.current, point];
    const stroke: Stroke = {
      color: brushColor,
      points: [previous, point],
      size: brushSize,
      type: "draw",
    };
    drawStroke(event.currentTarget.getContext("2d")!, stroke);
    sendMessage(stroke);
  }

  function endDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (drawingRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drawingRef.current = false;
    activeStrokeRef.current = [];
  }

  function sendGuess() {
    const message = guessDraft.trim();
    if (!message || !canGuess) {
      return;
    }

    sendMessage({ message: message.slice(0, 80), type: "guess" });
    setGuessDraft("");
  }

  const modeDescription =
    mode === "classic"
      ? "방장이 시작하면 랜덤 순서로 한 명씩 출제하고, 출제자는 후보 3개 중 하나를 고릅니다."
      : "3명 이상에서 시작합니다. 한 명은 카테고리만 받고, 모두가 5초씩 같은 캔버스에 이어 그린 뒤 라이어를 투표합니다.";

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#171411]">
      <div className="mx-auto flex w-[min(1220px,calc(100%-32px))] flex-col gap-5 py-5">
        <nav className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
          <Link
            className="rounded-lg border border-[#d9d1c3] bg-white px-4 py-2 text-sm font-black"
            href="/"
          >
            홈으로
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#5f584e]">
            <span>온라인 그림 퀴즈</span>
            <span className="rounded-full bg-[#1f2937] px-3 py-1 text-white">{connection}</span>
          </div>
        </nav>

        <section className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
          <aside className="flex flex-col gap-4">
            <div className="rounded-lg border border-[#d9d1c3] bg-white p-4">
              <label className="text-sm font-black" htmlFor="nickname">
                닉네임
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-[#d9d1c3] px-3 py-2 text-sm font-bold outline-none focus:border-[#2563eb]"
                id="nickname"
                maxLength={16}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="닉네임"
                value={nickname}
              />
            </div>

            <div className="rounded-lg border border-[#d9d1c3] bg-white p-4">
              <label className="text-sm font-black" htmlFor="room-code">
                방 코드
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-[#d9d1c3] px-3 py-2 text-sm font-black uppercase outline-none focus:border-[#2563eb]"
                  id="room-code"
                  onChange={(event) => setDraftCode(normalizeCode(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      joinRoom(draftCode);
                    }
                  }}
                  placeholder="ABC123"
                  value={draftCode}
                />
                <button
                  className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-black text-white"
                  onClick={() => joinRoom(draftCode)}
                  type="button"
                >
                  입장
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="rounded-lg border border-[#d9d1c3] px-3 py-2 text-sm font-bold"
                  onClick={createRoom}
                  type="button"
                >
                  새 방
                </button>
                <button
                  className="rounded-lg border border-[#d9d1c3] px-3 py-2 text-sm font-bold disabled:opacity-45"
                  disabled={!roomCode}
                  onClick={() => void copyInviteUrl()}
                  type="button"
                >
                  초대 복사
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-[#d9d1c3] bg-white p-4">
              <p className="text-sm font-black">게임 모드</p>
              <div className="mt-3 grid gap-2">
                {[
                  ["classic", "일반 캐치마인드"],
                  ["liar", "라이어 캐치마인드"],
                ].map(([value, label]) => (
                  <button
                    className={`rounded-lg border px-3 py-3 text-left text-sm font-black ${
                      mode === value ? "border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]" : "border-[#d9d1c3]"
                    }`}
                    key={value}
                    onClick={() => setMode(value as GameMode)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm leading-6 text-[#6f685e]">{modeDescription}</p>
              <button
                className="mt-4 w-full rounded-lg bg-[#111827] px-4 py-3 text-sm font-black text-white disabled:opacity-45"
                disabled={!isConnected || !isHost || !["lobby", "finished", "liarRevealed"].includes(game.phase)}
                onClick={() => startRound()}
                type="button"
              >
                게임 시작
              </button>
              {game.phase === "betweenGames" && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    className="rounded-lg bg-[#2563eb] px-3 py-3 text-sm font-black text-white disabled:opacity-45"
                    disabled={!isConnected || !isHost}
                    onClick={continueGame}
                    type="button"
                  >
                    한 라운드 더
                  </button>
                  <button
                    className="rounded-lg border border-[#d9d1c3] px-3 py-3 text-sm font-black disabled:opacity-45"
                    disabled={!isConnected || !isHost}
                    onClick={endGame}
                    type="button"
                  >
                    종료
                  </button>
                </div>
              )}
              {isConnected && !isHost && (
                <p className="mt-2 text-xs font-bold text-[#7c7165]">방장만 게임을 시작할 수 있습니다.</p>
              )}
            </div>

            <div className="rounded-lg border border-[#d9d1c3] bg-white p-4">
              <p className="text-sm font-black">플레이어</p>
              <div className="mt-3 flex flex-col gap-2">
                {game.players.length === 0 ? (
                  <p className="rounded-lg bg-[#f3f0e9] px-3 py-4 text-center text-sm text-[#6f685e]">
                    입장한 플레이어가 없습니다.
                  </p>
                ) : (
                  game.players.map((player) => (
                    <div
                      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-3 py-2 ${
                        player.id === game.drawerId ? "bg-[#fff7ed]" : "bg-[#f3f0e9]"
                      }`}
                      key={player.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{player.nickname}</p>
                        <p className="text-xs font-bold text-[#7c7165]">
                          {player.id === game.drawerId
                            ? isLiarMode
                              ? "그리는 중"
                              : "출제자"
                            : game.correctPlayerIds.includes(player.id)
                              ? "정답"
                              : player.id === game.hostId
                                ? "방장"
                                : player.id === game.you
                                  ? "나"
                                  : "참가자"}
                        </p>
                      </div>
                      <span className="text-sm font-black">{player.score}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>

          <section className="flex flex-col gap-4">
            <div className="rounded-lg border border-[#d9d1c3] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#6f685e]">
                    {isLiarMode ? "라이어 캐치마인드" : "제시어"}
                  </p>
                  {isLiarMode && game.isLiar && ["liarDrawing", "voting"].includes(game.phase) ? (
                    <div className="mt-2 rounded-lg bg-[#fee2e2] p-4 text-[#991b1b]">
                      <h1 className="text-2xl font-black">당신은 라이어입니다.</h1>
                      <p className="mt-2 text-sm font-bold">정답은 알 수 없습니다.</p>
                      <p className="mt-2 text-lg font-black">카테고리 : {game.category || "-"}</p>
                      <p className="mt-2 text-sm font-bold">정체를 숨기며 그림을 이어 그리세요.</p>
                    </div>
                  ) : (
                    <h1 className="mt-1 text-3xl font-black">
                      {game.word || (game.phase === "choosing" ? "출제자 선택 중" : "라운드 대기 중")}
                    </h1>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#6f685e]">{isLiarMode ? "현재 차례" : "출제자"}</p>
                  <p className="text-lg font-black">{game.drawerName || "-"}</p>
                </div>
              </div>
              {game.phase === "choosing" && isDrawer && (
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {game.wordCandidates.map((candidate, index) => (
                    <button
                      className="rounded-lg border border-[#2563eb] bg-[#eff6ff] px-4 py-4 text-lg font-black text-[#1d4ed8] transition hover:bg-[#dbeafe]"
                      key={candidate}
                      onClick={() => selectWord(index)}
                      type="button"
                    >
                      {candidate}
                    </button>
                  ))}
                </div>
              )}
              {game.phase === "choosing" && !isDrawer && (
                <p className="mt-3 rounded-lg bg-[#f3f0e9] px-3 py-2 text-sm font-bold text-[#6f685e]">
                  출제자가 단어 후보 3개 중 하나를 고르는 중입니다.
                </p>
              )}
              {game.phase === "drawing" && (
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#f3f0e9]">
                  <div
                    className="h-full rounded-full bg-[#2563eb] transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, (remainingSeconds / 80) * 100))}%` }}
                  />
                </div>
              )}
              {game.phase === "liarDrawing" && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="h-3 overflow-hidden rounded-full bg-[#f3f0e9] sm:col-span-2">
                    <div
                      className="h-full rounded-full bg-[#2563eb] transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, (remainingSeconds / 90) * 100))}%` }}
                    />
                  </div>
                  <p className="rounded-lg bg-[#eff6ff] px-3 py-2 text-sm font-black text-[#1d4ed8]">
                    전체 남은 시간 {remainingSeconds}초
                  </p>
                  <p className="rounded-lg bg-[#fff7ed] px-3 py-2 text-sm font-black text-[#9a3412]">
                    이번 차례 {turnRemainingSeconds}초
                  </p>
                </div>
              )}
              {hasGuessedCorrect && game.phase === "drawing" && (
                <p className="mt-3 rounded-lg bg-[#dcfce7] px-3 py-2 text-sm font-black text-[#166534]">
                  정답을 맞혔습니다. 다음 차례까지 입력이 잠깁니다.
                </p>
              )}
              {game.phase === "revealed" && game.liarName && (
                <p className="mt-3 rounded-lg bg-[#fef3c7] px-3 py-2 text-sm font-black text-[#92400e]">
                  라이어: {game.liarName}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-[#d9d1c3] bg-white p-3">
              <canvas
                className={`aspect-[4/3] w-full touch-none rounded-lg border border-[#e7dfd3] bg-[#fffdf8] ${
                  canDraw ? "cursor-crosshair" : "cursor-default"
                }`}
                height={720}
                onPointerCancel={endDraw}
                onPointerDown={beginDraw}
                onPointerLeave={endDraw}
                onPointerMove={moveDraw}
                onPointerUp={endDraw}
                ref={canvasRef}
                width={960}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d9d1c3] bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                {colors.map((color) => (
                  <button
                    aria-label={`${color} 색상`}
                    className={`h-9 w-9 rounded-full border-2 ${
                      brushColor === color ? "border-[#111827]" : "border-white"
                    } shadow`}
                    key={color}
                    onClick={() => setBrushColor(color)}
                    style={{ backgroundColor: color }}
                    type="button"
                  />
                ))}
                <input
                  aria-label="브러시 크기"
                  className="w-28"
                  max={24}
                  min={2}
                  onChange={(event) => setBrushSize(Number(event.target.value))}
                  type="range"
                  value={brushSize}
                />
                <span className="text-sm font-black">{brushSize}px</span>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-lg border border-[#d9d1c3] px-4 py-2 text-sm font-black disabled:opacity-45"
                  disabled={!canDraw}
                  onClick={clearCanvas}
                  type="button"
                >
                  지우기
                </button>
                <button
                  className="rounded-lg border border-[#d9d1c3] px-4 py-2 text-sm font-black disabled:opacity-45"
                  disabled={!isConnected || !["drawing", "liarDrawing"].includes(game.phase)}
                  onClick={revealAnswer}
                  type="button"
                >
                  {game.phase === "liarDrawing" ? "투표 시작" : "정답 공개"}
                </button>
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <div className="rounded-lg border border-[#d9d1c3] bg-white p-4">
              <p className="text-sm font-black">상태</p>
              <p className="mt-2 text-lg font-black">{game.status}</p>
              {notice && <p className="mt-3 text-sm leading-6 text-[#2563eb]">{notice}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-[#f3f0e9] p-3">
                  <p className="text-xs font-bold text-[#6f685e]">방</p>
                  <p className="mt-1 text-sm font-black">{roomCode || "-"}</p>
                </div>
                <div className="rounded-lg bg-[#f3f0e9] p-3">
                  <p className="text-xs font-bold text-[#6f685e]">라운드</p>
                  <p className="mt-1 text-sm font-black">
                    {game.round || 0}/{game.turnOrder.length || game.players.length || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-[#f3f0e9] p-3">
                  <p className="text-xs font-bold text-[#6f685e]">남은 시간</p>
                  <p className="mt-1 text-sm font-black">
                    {["drawing", "liarDrawing"].includes(game.phase) ? `${remainingSeconds}초` : "-"}
                  </p>
                </div>
                <div className="rounded-lg bg-[#f3f0e9] p-3">
                  <p className="text-xs font-bold text-[#6f685e]">{isLiarMode ? "투표" : "정답자"}</p>
                  <p className="mt-1 text-sm font-black">
                    {isLiarMode
                      ? `${game.votesCast}/${game.players.length}`
                      : `${game.correctPlayerIds.length}/${Math.max(0, game.players.length - 1)}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex min-h-[520px] flex-col rounded-lg border border-[#d9d1c3] bg-white p-4">
              <p className="text-sm font-black">
                {game.phase === "voting" ? "라이어 투표" : game.phase === "liarRevealed" ? "투표 결과" : "정답 입력 및 채팅"}
              </p>
              {game.phase === "voting" && (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="rounded-lg bg-[#fef3c7] px-3 py-3 text-sm font-black text-[#92400e]">
                    정답은 아직 공개되지 않습니다. 라이어라고 생각하는 사람을 고르세요.
                  </p>
                  {game.players.map((player) => (
                    <button
                      className={`rounded-lg border px-3 py-3 text-left text-sm font-black ${
                        game.myVote === player.id
                          ? "border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]"
                          : "border-[#d9d1c3] bg-[#f3f0e9]"
                      }`}
                      key={player.id}
                      onClick={() => vote(player.id)}
                      type="button"
                    >
                      {player.nickname}
                    </button>
                  ))}
                </div>
              )}
              {game.phase === "liarRevealed" && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="rounded-lg bg-[#eff6ff] px-3 py-3">
                    <p className="text-xs font-black text-[#1d4ed8]">정답</p>
                    <p className="mt-1 text-2xl font-black">{game.word}</p>
                    <p className="mt-1 text-sm font-bold text-[#4b5563]">카테고리: {game.category}</p>
                  </div>
                  <div className="rounded-lg bg-[#fee2e2] px-3 py-3">
                    <p className="text-xs font-black text-[#991b1b]">라이어</p>
                    <p className="mt-1 text-xl font-black">{game.liarName || "-"}</p>
                  </div>
                  <div className="rounded-lg bg-[#f3f0e9] px-3 py-3">
                    <p className="text-xs font-black text-[#6f685e]">승리</p>
                    <p className="mt-1 text-xl font-black">
                      {game.winnerTeam === "citizens" ? "일반 플레이어 승리" : "라이어 승리"}
                    </p>
                  </div>
                  {game.players.map((player) => (
                    <div
                      className="grid grid-cols-[minmax(0,1fr)_48px] rounded-lg bg-[#f3f0e9] px-3 py-2 text-sm font-bold"
                      key={player.id}
                    >
                      <span className="truncate">{player.nickname}</span>
                      <span className="text-right">{game.voteCounts?.[player.id] ?? 0}표</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-[#e7dfd3] bg-[#fffdf8] p-3">
                {chatMessages.length === 0 ? (
                  <p className="my-auto text-center text-sm text-[#7c7165]">
                    정답과 메시지가 여기에 표시됩니다.
                  </p>
                ) : (
                  chatMessages.map((chat) => (
                    <div
                      className={`rounded-lg px-3 py-2 ${
                        chat.system ? "bg-[#eff6ff] text-[#1d4ed8]" : "bg-[#f3f0e9]"
                      }`}
                      key={chat.id}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs font-black opacity-70">
                        <span>{chat.sender}</span>
                        <span>
                          {new Date(chat.sentAt).toLocaleTimeString("ko-KR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-sm font-bold leading-5">{chat.message}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-[#d9d1c3] px-3 py-2 text-sm font-bold outline-none focus:border-[#2563eb]"
                  disabled={!canGuess}
                  maxLength={80}
                  onChange={(event) => setGuessDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      sendGuess();
                    }
                  }}
                  placeholder={
                    isLiarMode
                      ? "라이어 모드에서는 투표로 진행합니다"
                      : hasGuessedCorrect
                      ? "이미 정답을 맞혔습니다"
                      : isDrawer
                        ? "출제자는 정답을 입력할 수 없습니다"
                        : game.phase === "drawing"
                          ? "정답을 입력하세요"
                          : "그리기가 시작되면 입력할 수 있습니다"
                  }
                  value={guessDraft}
                />
                <button
                  className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-black text-white disabled:opacity-45"
                  disabled={!canGuess || !guessDraft.trim()}
                  onClick={sendGuess}
                  type="button"
                >
                  전송
                </button>
              </div>
            </div>
          </aside>
        </section>
      </div>
      {showScoreDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div className="w-full max-w-md rounded-lg border border-[#d9d1c3] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-[#2563eb]">최종 순위</p>
                <h2 className="mt-1 text-2xl font-black">게임 결과</h2>
              </div>
              <button
                className="rounded-lg border border-[#d9d1c3] px-3 py-2 text-sm font-black"
                onClick={() => setDismissedScoreStamp(scoreStamp)}
                type="button"
              >
                닫기
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {ranking.map((player, index) => (
                <div
                  className={`grid grid-cols-[40px_minmax(0,1fr)_80px] items-center gap-3 rounded-lg px-3 py-3 ${
                    index === 0 ? "bg-[#fef3c7]" : "bg-[#f3f0e9]"
                  }`}
                  key={player.id}
                >
                  <span className="text-lg font-black">{index + 1}</span>
                  <span className="truncate text-sm font-black">{player.nickname}</span>
                  <span className="text-right text-lg font-black">{player.score}점</span>
                </div>
              ))}
            </div>
            {isHost && (
              <button
                className="mt-4 w-full rounded-lg bg-[#111827] px-4 py-3 text-sm font-black text-white"
                onClick={() => {
                  setDismissedScoreStamp(scoreStamp);
                  startRound();
                }}
                type="button"
              >
                새 게임 시작
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
