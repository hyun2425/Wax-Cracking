"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Cell = 0 | 1 | 2;
type Role = 0 | 1 | 2;
type ConnectionState = "idle" | "connecting" | "open" | "closed";

type GameState = {
  board: Cell[][];
  players: number;
  room: string;
  spectators: number;
  status: string;
  turn: 1 | 2;
  winner: Cell;
  you: Role;
};

type ChatMessage = {
  id: string;
  message: string;
  sender: string;
  senderRole: Role;
  sentAt: number;
};

type PlayerProfile = {
  nickname: string;
  playerId: string;
};

type LeaderboardEntry = {
  games: number;
  losses: number;
  nickname: string;
  playerId: string;
  winRate: number;
  wins: number;
};

type ServerMessage =
  | (GameState & { type: "state" })
  | { message: string; type: "error" }
  | { leaders: LeaderboardEntry[]; type: "leaderboard" }
  | { message: string; sender: string; senderRole: Role; sentAt: number; type: "chat" };

const boardSize = 15;
const localApiBaseUrl = "http://localhost:8080";
const deployedApiBaseUrl = "https://wax-cracking-backend.onrender.com";

function makeEmptyBoard() {
  return Array.from({ length: boardSize }, () =>
    Array.from({ length: boardSize }, () => 0 as Cell),
  );
}

function initialGame(room = ""): GameState {
  return {
    board: makeEmptyBoard(),
    players: 0,
    room,
    spectators: 0,
    status: "초대 코드를 만들거나 받은 코드를 입력해서 같이 오목을 시작하세요.",
    turn: 1,
    winner: 0,
    you: 0,
  };
}

function stoneName(player: Cell) {
  if (player === 1) {
    return "검은 돌";
  }
  if (player === 2) {
    return "흰 돌";
  }
  return "관전자";
}

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
  const apiBaseUrl = getApiBaseUrl();
  const socketBaseUrl = apiBaseUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  return `${socketBaseUrl}/ws/gomoku?room=${encodeURIComponent(roomCode)}`;
}

function getInitialRoomCode() {
  if (typeof window === "undefined") {
    return "";
  }

  return normalizeCode(new URLSearchParams(window.location.search).get("room") ?? "");
}

function makePlayerId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getInitialProfile(): PlayerProfile {
  if (typeof window === "undefined") {
    return { nickname: "", playerId: "server" };
  }

  const playerId = window.localStorage.getItem("gomokuPlayerId") ?? makePlayerId();
  const nickname = window.localStorage.getItem("gomokuNickname") ?? "";
  window.localStorage.setItem("gomokuPlayerId", playerId);
  return { nickname, playerId };
}

function sanitizeNickname(value: string) {
  const next = value.trim().replace(/\s+/g, " ");
  return (next || "이름 없는 고수").slice(0, 16);
}

function isProfileReady(profile: PlayerProfile) {
  return profile.nickname.trim().length > 0;
}

function getConnectionLabel(connection: ConnectionState) {
  if (connection === "open") {
    return "연결됨";
  }
  if (connection === "connecting") {
    return "연결 중";
  }
  if (connection === "closed") {
    return "연결 끊김";
  }
  return "대기 중";
}

function getCellLabel(cell: Cell, row: number, col: number) {
  if (cell === 0) {
    return `${row + 1}행 ${col + 1}열에 두기`;
  }
  return `${row + 1}행 ${col + 1}열 ${stoneName(cell)}`;
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

export default function GomokuPage() {
  const initialProfile = useMemo(() => getInitialProfile(), []);
  const [draftCode, setDraftCode] = useState(() => getInitialRoomCode());
  const [roomCode, setRoomCode] = useState("");
  const [game, setGame] = useState<GameState>(() => initialGame());
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [notice, setNotice] = useState("닉네임 로그인 후 방에 입장해 주세요.");
  const [profile, setProfile] = useState<PlayerProfile>(() => initialProfile);
  const [nicknameDraft, setNicknameDraft] = useState(() => initialProfile.nickname);
  const [isLoggedIn, setIsLoggedIn] = useState(() => isProfileReady(initialProfile) && !getInitialRoomCode());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef(profile);
  const socketRef = useRef<WebSocket | null>(null);

  const isConnected = connection === "open";
  const gameStamp = useMemo(() => game.board.map((row) => row.join("")).join("|"), [game.board]);
  const [dismissedWinStamp, setDismissedWinStamp] = useState("");
  const showWinnerDialog = game.winner !== 0 && dismissedWinStamp !== gameStamp;
  const winnerTitle =
    game.winner === 0
      ? ""
      : game.you === game.winner
        ? "승리!"
        : game.you === 0
          ? `${game.winner === 1 ? "검은 돌" : "흰 돌"} 승리!`
          : "패배";
  const winnerDetail =
    game.winner === 0
      ? ""
      : game.you === 0
        ? `${game.winner === 1 ? "검은 돌" : "흰 돌"}이 이겼습니다.`
        : game.you === game.winner
          ? "오목을 완성했습니다."
          : `${game.winner === 1 ? "검은 돌" : "흰 돌"}이 오목을 완성했습니다.`;
  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined" || !roomCode) {
      return "";
    }

    const url = new URL(window.location.href);
    url.searchParams.set("room", roomCode);
    return url.toString();
  }, [roomCode]);

  const myStats = leaderboard.find((entry) => entry.playerId === profile.playerId);

  const refreshLeaderboard = useCallback(async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/gomoku/leaderboard`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Leaderboard ${response.status}`);
      }
      const data = (await response.json()) as LeaderboardEntry[];
      setLeaderboard(data);
    } catch {
      setLeaderboard([]);
    }
  }, []);

  useEffect(() => {
    profileRef.current = profile;
    window.localStorage.setItem("gomokuPlayerId", profile.playerId);
    if (profile.nickname.trim()) {
      window.localStorage.setItem("gomokuNickname", profile.nickname);
    }

    const socket = socketRef.current;
    if (isLoggedIn && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ ...profile, type: "profile" }));
    }
  }, [isLoggedIn, profile]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void refreshLeaderboard();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [refreshLeaderboard]);

  useEffect(() => {
    if (!roomCode) {
      return;
    }

    if (!isLoggedIn) {
      return;
    }

    const socket = new WebSocket(getSocketUrl(roomCode));
    const timeoutId = window.setTimeout(() => {
      if (socket.readyState === WebSocket.CONNECTING) {
        setNotice(
          "서버 연결이 오래 걸리고 있어요. Render 무료 서버가 잠들어 있었다면 깨우는 데 시간이 걸릴 수 있습니다.",
        );
      }
    }, 15000);

    socketRef.current = socket;

    socket.onopen = () => {
      window.clearTimeout(timeoutId);
      setConnection("open");
      setNotice("연결되었습니다. 상대도 같은 초대 코드로 들어오면 바로 같이 둘 수 있어요.");
      socket.send(JSON.stringify({ ...profileRef.current, type: "profile" }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "error") {
        setNotice(message.message);
        return;
      }

      if (message.type === "chat") {
        setChatMessages((current) => [
          ...current.slice(-59),
          {
            id: `${message.sentAt}-${current.length}`,
            message: message.message,
            sender: message.sender,
            senderRole: message.senderRole,
            sentAt: message.sentAt,
          },
        ]);
        return;
      }

      if (message.type === "leaderboard") {
        setLeaderboard(message.leaders);
        return;
      }

      const nextGame: GameState = {
        board: message.board,
        players: message.players,
        room: message.room,
        spectators: message.spectators,
        status: message.status,
        turn: message.turn,
        winner: message.winner,
        you: message.you,
      };
      setGame(nextGame);
      if (nextGame.winner !== 0) {
        setNotice(`${stoneName(nextGame.winner)} 승리! 전적과 랭킹에 반영했습니다.`);
        window.setTimeout(() => {
          void refreshLeaderboard();
        }, 600);
      } else {
        setNotice("");
      }
    };

    socket.onerror = () => {
      window.clearTimeout(timeoutId);
      setConnection("closed");
      setNotice(
        `서버 연결을 확인해 주세요. 백엔드 서버(${getApiBaseUrl()})가 켜져 있어야 실시간으로 둘 수 있습니다.`,
      );
    };

    socket.onclose = () => {
      window.clearTimeout(timeoutId);
      setConnection("closed");
      setNotice((current) => current || "방 연결이 끊겼습니다. 다시 입장해 주세요.");
    };

    return () => {
      window.clearTimeout(timeoutId);
      socket.close();
    };
  }, [isLoggedIn, refreshLeaderboard, roomCode, reconnectAttempt]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chatMessages]);

  const sendMessage = useCallback((message: object) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setNotice("아직 서버에 연결되지 않았습니다.");
      return;
    }

    socket.send(JSON.stringify(message));
  }, []);

  function joinRoom(code: string, allowAfterLogin = false) {
    const nextCode = normalizeCode(code);
    if (!nextCode) {
      setNotice("초대 코드를 입력해 주세요.");
      return;
    }

    if (!isLoggedIn && !allowAfterLogin) {
      setDraftCode(nextCode);
      setNotice("먼저 닉네임으로 로그인해 주세요.");
      return;
    }

    setDraftCode(nextCode);
    setRoomCode(nextCode);
    setConnection("connecting");
    setGame(initialGame(nextCode));
    setChatMessages([]);
    setReconnectAttempt((attempt) => attempt + 1);

    const url = new URL(window.location.href);
    url.searchParams.set("room", nextCode);
    window.history.replaceState(null, "", url.toString());
  }

  function createRoom() {
    joinRoom(makeInviteCode());
  }

  function handleMove(row: number, col: number) {
    sendMessage({ col, row, type: "move" });
  }

  function resetGame() {
    setDismissedWinStamp("");
    sendMessage({ type: "reset" });
  }

  function sendChat() {
    const message = chatDraft.trim();
    if (!message) {
      return;
    }

    sendMessage({ message: message.slice(0, 200), type: "chat" });
    setChatDraft("");
  }

  function saveNickname() {
    const nickname = sanitizeNickname(nicknameDraft);
    setNicknameDraft(nickname);
    setProfile((current) => ({ ...current, nickname }));
    setIsLoggedIn(true);
    setNotice(`${nickname} 닉네임으로 로그인했습니다.`);

    if (draftCode) {
      window.setTimeout(() => joinRoom(draftCode, true), 0);
    }
  }

  async function copyInviteUrl() {
    if (!inviteUrl) {
      setNotice("먼저 방을 만들어 주세요.");
      return;
    }

    await navigator.clipboard.writeText(inviteUrl);
    setNotice("초대 링크를 복사했습니다.");
  }

  const linePositions = Array.from({ length: boardSize }, (_, index) =>
    (index / (boardSize - 1)) * 100,
  );
  const starPoints = [
    [3, 3],
    [3, 11],
    [7, 7],
    [11, 3],
    [11, 11],
  ];

  return (
    <main className="min-h-screen bg-[#18130f] px-5 py-8 text-zinc-100 sm:px-8">
      {!isLoggedIn && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-5 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-lg border border-[#e4b467]/45 bg-[#201812] p-6 shadow-2xl shadow-black/40">
            <p className="text-sm font-semibold text-[#ffd07a]">오목 시작하기</p>
            <h2 className="mt-2 text-3xl font-black text-white">닉네임을 먼저 정해 주세요</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              전적, 승률, 랭킹, 채팅 이름에 이 닉네임이 사용됩니다.
            </p>
            {draftCode && (
              <p className="mt-3 rounded-lg bg-black/25 px-3 py-2 text-sm font-semibold text-zinc-200">
                로그인 후 `{draftCode}` 방에 자동 입장합니다.
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <input
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/25 px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[#e4b467]"
                maxLength={16}
                onChange={(event) => setNicknameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    saveNickname();
                  }
                }}
                placeholder="닉네임"
                value={nicknameDraft}
              />
              <button
                className="rounded-lg bg-[#e4b467] px-5 py-3 text-sm font-black text-[#20110a] transition hover:bg-[#ffd07a]"
                onClick={saveNickname}
                type="button"
              >
                시작
              </button>
            </div>
          </div>
        </div>
      )}
      {showWinnerDialog && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-5 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-sm rounded-lg border border-[#e4b467]/45 bg-[#201812] p-6 text-center shadow-2xl shadow-black/40">
            <p className="text-sm font-semibold text-[#ffd07a]">게임 종료</p>
            <h2 className="mt-2 text-4xl font-black text-white">{winnerTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{winnerDetail}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                className="rounded-lg border border-white/15 px-4 py-3 text-sm font-bold text-zinc-100 transition hover:border-white/35"
                onClick={() => setDismissedWinStamp(gameStamp)}
                type="button"
              >
                종료
              </button>
              <button
                className="rounded-lg bg-[#e4b467] px-4 py-3 text-sm font-black text-[#20110a] transition hover:bg-[#ffd07a] disabled:opacity-45"
                disabled={!isConnected}
                onClick={resetGame}
                type="button"
              >
                한 판 더
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <nav className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-white/35 hover:text-white"
          >
            홈으로
          </Link>
          <span className="text-sm text-zinc-400">실시간 오목</span>
        </nav>

        <section className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_280px]">
          <aside className="flex flex-col gap-4">
            <div className="rounded-lg border border-white/15 bg-[#201812] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-300">닉네임 로그인</p>
                  <p className="mt-1 text-xs text-zinc-500">전적과 랭킹에 표시됩니다.</p>
                </div>
                <span className="rounded-full bg-[#e4b467]/15 px-3 py-1 text-xs font-bold text-[#ffd07a]">
                  {profile.nickname}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[#e4b467]"
                  maxLength={16}
                  onChange={(event) => setNicknameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      saveNickname();
                    }
                  }}
                  placeholder="닉네임"
                  value={nicknameDraft}
                />
                <button
                  className="rounded-lg bg-[#e4b467] px-4 py-2 text-sm font-bold text-[#20110a] transition hover:bg-[#ffd07a]"
                  onClick={saveNickname}
                  type="button"
                >
                  저장
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/10 px-2 py-2">
                  <p className="text-xs text-zinc-400">전적</p>
                  <p className="mt-1 text-sm font-bold text-white">{myStats?.games ?? 0}전</p>
                </div>
                <div className="rounded-lg bg-white/10 px-2 py-2">
                  <p className="text-xs text-zinc-400">승리</p>
                  <p className="mt-1 text-sm font-bold text-white">{myStats?.wins ?? 0}승</p>
                </div>
                <div className="rounded-lg bg-white/10 px-2 py-2">
                  <p className="text-xs text-zinc-400">승률</p>
                  <p className="mt-1 text-sm font-bold text-white">{myStats?.winRate ?? 0}%</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/15 bg-[#201812] p-4">
              <label className="text-sm font-semibold text-zinc-200" htmlFor="room-code">
                초대 코드
              </label>
              <div className="mt-3 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm font-semibold uppercase text-white outline-none transition placeholder:text-zinc-500 focus:border-[#e4b467]"
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
                  className="rounded-lg bg-[#e4b467] px-4 py-2 text-sm font-bold text-[#20110a] transition hover:bg-[#ffd07a]"
                  onClick={() => joinRoom(draftCode)}
                  type="button"
                >
                  입장
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-white/35"
                  onClick={createRoom}
                  type="button"
                >
                  새 코드
                </button>
                <button
                  className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-white/35 disabled:opacity-45"
                  disabled={!roomCode}
                  onClick={copyInviteUrl}
                  type="button"
                >
                  링크 복사
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              <StatusItem label="연결" value={getConnectionLabel(connection)} />
              <StatusItem label="방 코드" value={roomCode || "-"} />
              <StatusItem label="내 돌" value={stoneName(game.you)} />
              <StatusItem label="인원" value={`${game.players}명 / 관전 ${game.spectators}명`} />
            </div>

            <div className="rounded-lg border border-white/15 bg-[#201812] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-zinc-300">전체 랭킹</p>
                <button
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold text-zinc-100 transition hover:border-white/35"
                  onClick={() => void refreshLeaderboard()}
                  type="button"
                >
                  새로고침
                </button>
              </div>
              <div className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto">
                {leaderboard.length === 0 ? (
                  <p className="rounded-lg bg-black/20 px-3 py-5 text-center text-sm text-zinc-500">
                    아직 기록된 승부가 없습니다.
                  </p>
                ) : (
                  leaderboard.map((entry, index) => (
                    <div
                      className={`grid grid-cols-[28px_minmax(0,1fr)_76px] items-center gap-2 rounded-lg px-3 py-2 ${
                        entry.playerId === profile.playerId
                          ? "bg-[#e4b467] text-[#20110a]"
                          : "bg-white/10 text-zinc-100"
                      }`}
                      key={entry.playerId}
                    >
                      <span className="text-sm font-black">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{entry.nickname}</p>
                        <p className="text-xs opacity-70">
                          {entry.games}전 {entry.wins}승 {entry.losses}패
                        </p>
                      </div>
                      <p className="text-right text-sm font-black">{entry.winRate}%</p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </aside>

          <div className="flex flex-col gap-5">
            <div className="rounded-lg border border-white/15 bg-[#201812] p-4 shadow-2xl shadow-black/25">
              <div className="mx-auto aspect-square w-full max-w-[min(860px,calc(100vh-150px))] rounded-lg border border-[#8c6635] bg-[#d8a24d] p-[5.5%] shadow-[inset_0_0_34px_rgba(91,54,20,0.55)]">
                <div className="relative h-full w-full">
                  <svg
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full overflow-visible"
                    preserveAspectRatio="none"
                    viewBox="0 0 100 100"
                  >
                    <defs>
                      <linearGradient id="gomokuWood" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0%" stopColor="#f1c56a" />
                        <stop offset="48%" stopColor="#d8a24d" />
                        <stop offset="100%" stopColor="#bd7f35" />
                      </linearGradient>
                    </defs>
                    <rect fill="url(#gomokuWood)" height="100" width="100" x="0" y="0" />
                    {linePositions.map((position, index) => (
                      <g key={position}>
                        <line
                          stroke="#2c2118"
                          strokeLinecap="square"
                          strokeWidth={index === 0 || index === boardSize - 1 ? 0.72 : 0.42}
                          x1={position}
                          x2={position}
                          y1="0"
                          y2="100"
                        />
                        <line
                          stroke="#2c2118"
                          strokeLinecap="square"
                          strokeWidth={index === 0 || index === boardSize - 1 ? 0.72 : 0.42}
                          x1="0"
                          x2="100"
                          y1={position}
                          y2={position}
                        />
                      </g>
                    ))}
                  </svg>

                  {starPoints.map(([row, col]) => (
                    <span
                      aria-hidden="true"
                      className="absolute z-0 aspect-square w-[1.55%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2c2118]"
                      key={`${row}-${col}`}
                      style={{
                        left: `${(col / (boardSize - 1)) * 100}%`,
                        top: `${(row / (boardSize - 1)) * 100}%`,
                      }}
                    />
                  ))}

                  {game.board.map((row, rowIndex) =>
                    row.map((cell, colIndex) => (
                      <button
                        aria-label={getCellLabel(cell, rowIndex, colIndex)}
                        className="absolute z-10 flex aspect-square w-[8.4%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-transparent outline-none transition focus-visible:ring-2 focus-visible:ring-[#b33d21] disabled:cursor-default"
                        disabled={!isConnected || cell !== 0 || game.winner !== 0}
                        key={`${rowIndex}-${colIndex}`}
                        onClick={() => handleMove(rowIndex, colIndex)}
                        style={{
                          left: `${(colIndex / (boardSize - 1)) * 100}%`,
                          top: `${(rowIndex / (boardSize - 1)) * 100}%`,
                        }}
                      >
                        {cell !== 0 && (
                          <span
                            className={`block aspect-square w-[78%] rounded-full shadow-[0_5px_7px_rgba(0,0,0,0.32)] ${
                              cell === 1
                                ? "bg-[radial-gradient(circle_at_32%_28%,#5b5b5b_0%,#181818_38%,#050505_74%)]"
                                : "bg-[radial-gradient(circle_at_32%_28%,#ffffff_0%,#eeeeee_45%,#c9c9c9_82%)]"
                            }`}
                          />
                        )}
                      </button>
                    )),
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <div className="rounded-lg border border-white/15 bg-[#201812] p-4">
              <p className="text-sm font-semibold text-zinc-300">상태</p>
              <p className="mt-2 text-lg font-bold text-white">{game.status}</p>
              {notice && <p className="mt-3 text-sm leading-6 text-[#ffd07a]">{notice}</p>}
              <button
                className="mt-4 w-full rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-white/35 disabled:opacity-45"
                disabled={!isConnected}
                onClick={resetGame}
                type="button"
              >
                다시 시작
              </button>
            </div>

            <div className="rounded-lg border border-white/15 bg-[#201812] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-zinc-300">채팅</p>
                <p className="text-xs font-semibold text-zinc-500">{chatMessages.length}개</p>
              </div>
              <div className="mt-3 flex h-48 flex-col gap-2 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3">
                {chatMessages.length === 0 ? (
                  <p className="my-auto text-center text-sm text-zinc-500">
                    같은 방에 있는 사람과 실시간으로 대화할 수 있어요.
                  </p>
                ) : (
                  chatMessages.map((chat) => (
                    <div
                      className={`rounded-lg px-3 py-2 ${
                        chat.senderRole === game.you && game.you !== 0
                          ? "bg-[#e4b467] text-[#20110a]"
                          : "bg-white/10 text-zinc-100"
                      }`}
                      key={chat.id}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs font-bold opacity-75">
                        <span>{chat.sender}</span>
                        <span>
                          {new Date(chat.sentAt).toLocaleTimeString("ko-KR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-sm leading-5">{chat.message}</p>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[#e4b467]"
                  disabled={!isConnected}
                  maxLength={200}
                  onChange={(event) => setChatDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      sendChat();
                    }
                  }}
                  placeholder={isConnected ? "메시지 입력" : "방에 연결하면 채팅 가능"}
                  value={chatDraft}
                />
                <button
                  className="rounded-lg bg-[#e4b467] px-4 py-2 text-sm font-bold text-[#20110a] transition hover:bg-[#ffd07a] disabled:opacity-45"
                  disabled={!isConnected || !chatDraft.trim()}
                  onClick={sendChat}
                  type="button"
                >
                  전송
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-white/15 bg-black/20 p-4 text-sm leading-6 text-zinc-400">
              같은 초대 코드를 입력한 두 명이 각각 검은 돌과 흰 돌로 배정됩니다. 세 번째부터는 관전자로 들어와요.
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
