"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Cell = 0 | 1 | 2;

type GameState = {
  board: Cell[][];
  players: number;
  room: string;
  spectators: number;
  status: string;
  turn: 1 | 2;
  winner: Cell;
  you: Cell;
};

type ServerMessage =
  | (GameState & { sessions?: Record<string, Cell>; type: "state" })
  | { message: string; type: "error" };

const boardSize = 15;
const emptyBoard = Array.from({ length: boardSize }, () =>
  Array.from({ length: boardSize }, () => 0 as Cell),
);

const localApiBaseUrl = "http://localhost:8080";
const deployedApiBaseUrl = "https://wax-cracking-backend.onrender.com";

function getApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window === "undefined") {
    return localApiBaseUrl;
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  return localHosts.has(window.location.hostname) ? localApiBaseUrl : deployedApiBaseUrl;
}

function makeInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
}

function normalizeCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 12);
}

function socketUrl(roomCode: string) {
  const base = getApiBaseUrl().replace(/^https?:\/\//, (match) =>
    match === "https://" ? "wss://" : "ws://",
  );
  return `${base}/ws/gomoku?room=${encodeURIComponent(roomCode)}`;
}

export default function GomokuPage() {
  const [draftCode, setDraftCode] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [game, setGame] = useState<GameState>({
    board: emptyBoard,
    players: 0,
    room: "",
    spectators: 0,
    status: "초대 코드를 만들거나 입력해 주세요.",
    turn: 1,
    winner: 0,
    you: 0,
  });
  const [connection, setConnection] = useState<"idle" | "connecting" | "open" | "closed">("idle");
  const [notice, setNotice] = useState("");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);

  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomCode || draftCode);
    return url.toString();
  }, [draftCode, roomCode]);

  useEffect(() => {
    if (!roomCode) {
      return;
    }

    const ws = new WebSocket(socketUrl(roomCode));
    let isActive = true;
    socketRef.current = ws;
    const timeoutId = window.setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.close();
        if (isActive) {
          setConnection("closed");
          setNotice(`연결 시간이 초과됐습니다. 백엔드 서버(${getApiBaseUrl()})가 켜져 있는지 확인해 주세요.`);
        }
      }
    }, 7000);

    ws.onopen = () => {
      if (!isActive) {
        return;
      }
      window.clearTimeout(timeoutId);
      setConnection("open");
    };
    ws.onclose = () => {
      if (!isActive) {
        return;
      }
      window.clearTimeout(timeoutId);
      setConnection("closed");
    };
    ws.onerror = () => {
      if (!isActive) {
        return;
      }
      window.clearTimeout(timeoutId);
      setConnection("closed");
      setNotice(`서버 연결을 확인해 주세요. 백엔드 서버(${getApiBaseUrl()})가 켜져 있어야 실시간으로 둘 수 있습니다.`);
    };
    ws.onmessage = (event) => {
      if (!isActive) {
        return;
      }
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "error") {
        setNotice(message.message);
        return;
      }

      setGame({
        board: message.board,
        players: message.players,
        room: message.room,
        spectators: message.spectators,
        status: message.status,
        turn: message.turn,
        winner: message.winner,
        you: message.you,
      });
      setNotice("");
    };

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      ws.close();
    };
  }, [roomCode, reconnectAttempt]);

  function joinRoom(code = draftCode) {
    const normalized = normalizeCode(code);
    if (!normalized) {
      setNotice("초대 코드를 입력해 주세요.");
      return;
    }
    setDraftCode(normalized);
    setConnection("connecting");
    setNotice("");
    setRoomCode(normalized);
    setReconnectAttempt((current) => current + 1);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("room", normalized);
      window.history.replaceState(null, "", url);
    }
  }

  function send(payload: object) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setNotice("아직 방에 연결되지 않았습니다.");
      return;
    }
    socket.send(JSON.stringify(payload));
  }

  async function copyInvite() {
    if (!inviteUrl) {
      return;
    }
    await navigator.clipboard.writeText(inviteUrl);
    setNotice("초대 링크를 복사했습니다.");
  }

  const isConnected = connection === "open";
  const connectionLabel =
    connection === "open"
      ? "온라인"
      : connection === "connecting"
        ? "연결 중"
        : connection === "closed"
          ? "연결 실패"
          : "대기";
  const turnLabel = game.turn === 1 ? "검은 돌" : "흰 돌";
  const myStone = game.you === 0 ? "관전" : game.you === 1 ? "검은 돌" : "흰 돌";

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const room = normalizeCode(new URLSearchParams(window.location.search).get("room") ?? "");
      const code = room || makeInviteCode();
      setDraftCode(code);

      if (room) {
        setConnection("connecting");
        setRoomCode(room);
      }
    }, 0);

    return () => window.clearTimeout(timerId);
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f4ed] text-[#191611]">
      <header className="border-b border-[#ded5c7] bg-[#fffbf4]">
        <nav
          aria-label="주요 메뉴"
          className="mx-auto flex w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4 py-5 max-sm:flex-col max-sm:items-start"
        >
          <Link className="text-sm font-extrabold" href="/">
            Wax-Cracking
          </Link>
          <div className="flex flex-wrap gap-4 text-sm font-bold text-[#6f685e]">
            <Link href="/">mk.ver</Link>
            <Link href="/hsj-ver">hsj.ver</Link>
            <Link href="/njjey-ver">njjey.ver</Link>
            <Link href="/ruby-gamja-walk-quest">ruby-gamja</Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid w-[min(1180px,calc(100%-32px))] grid-cols-[minmax(280px,0.75fr)_minmax(360px,1fr)] gap-8 py-10 max-lg:grid-cols-1">
        <aside className="space-y-4">
          <div className="rounded-lg border border-[#ded5c7] bg-white p-5 shadow-sm">
            <p className="text-sm font-extrabold uppercase text-[#2f7f6f]">
              Live Gomoku
            </p>
            <h1 className="mt-2 text-4xl font-extrabold leading-tight">
              실시간 오목
            </h1>
            <p className="mt-4 text-sm leading-6 text-[#6f685e]">
              같은 초대 코드를 넣으면 같은 방에 연결됩니다. 첫 접속자는 검은 돌,
              두 번째 접속자는 흰 돌입니다.
            </p>

            <div className="mt-6 grid gap-3">
              <label className="text-sm font-extrabold text-[#4f473d]" htmlFor="room-code">
                초대 코드
              </label>
              <input
                className="h-12 rounded-lg border border-[#d7ccba] bg-[#fffaf2] px-4 text-lg font-extrabold tracking-[0.18em] outline-none focus:border-[#2f7f6f]"
                id="room-code"
                maxLength={12}
                onChange={(event) => setDraftCode(normalizeCode(event.target.value))}
                value={draftCode}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="min-h-11 rounded-lg bg-[#191611] px-4 text-sm font-extrabold text-white"
                  onClick={() => joinRoom()}
                  type="button"
                >
                  방 입장
                </button>
                <button
                  className="min-h-11 rounded-lg border border-[#d7ccba] bg-white px-4 text-sm font-extrabold"
                  onClick={() => {
                    const code = makeInviteCode();
                    setDraftCode(code);
                    joinRoom(code);
                  }}
                  type="button"
                >
                  새 코드
                </button>
              </div>
              <button
                className="min-h-11 rounded-lg border border-[#bdd7d0] bg-[#edf8f4] px-4 text-sm font-extrabold text-[#1f6156] disabled:opacity-45"
                disabled={!roomCode}
                onClick={copyInvite}
                type="button"
              >
                초대 링크 복사
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-[#ded5c7] bg-white p-5 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <Status label="연결" value={connectionLabel} />
              <Status label="방 코드" value={roomCode || "-"} />
              <Status label="내 돌" value={myStone} />
              <Status label="플레이어" value={`${game.players}/2`} />
              <Status label="관전자" value={`${game.spectators}`} />
            </div>
            <div className="mt-4 rounded-lg bg-[#f7f4ed] p-4">
              <p className="text-sm font-extrabold text-[#6f685e]">현재 상태</p>
              <p className="mt-2 text-xl font-extrabold">{game.status}</p>
            </div>
            {notice ? (
              <p className="mt-4 rounded-lg border border-[#f0d5a8] bg-[#fff8ea] p-3 text-sm font-bold text-[#7a5618]">
                {notice}
              </p>
            ) : null}
          </div>
        </aside>

        <section className="rounded-lg border border-[#d8ccbb] bg-[#fbf0d7] p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start">
            <div>
              <p className="text-sm font-extrabold text-[#6f685e]">차례</p>
              <p className="text-2xl font-extrabold">{game.winner ? "게임 종료" : turnLabel}</p>
            </div>
            <button
              className="min-h-11 rounded-lg border border-[#bfae94] bg-white px-4 text-sm font-extrabold"
              onClick={() => send({ type: "reset" })}
              type="button"
            >
              새 판 시작
            </button>
          </div>

          <div className="mx-auto aspect-square w-full max-w-[720px] rounded-lg border-2 border-[#9f7f4f] bg-[#d8a95e] p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]">
            <div
              className="grid h-full w-full rounded-[4px] border border-[#8f6d3f]"
              style={{
                gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${boardSize}, minmax(0, 1fr))`,
              }}
            >
              {game.board.map((row, rowIndex) =>
                row.map((cell, colIndex) => (
                  <button
                    aria-label={`${rowIndex + 1}행 ${colIndex + 1}열`}
                    className="relative flex min-h-0 items-center justify-center border border-[#8f6d3f]/70 bg-transparent"
                    disabled={!isConnected || cell !== 0 || game.winner !== 0}
                    key={`${rowIndex}-${colIndex}`}
                    onClick={() =>
                      send({ col: colIndex, row: rowIndex, type: "move" })
                    }
                    type="button"
                  >
                    {cell !== 0 ? (
                      <span
                        className={`block aspect-square w-[78%] rounded-full shadow-lg ${
                          cell === 1
                            ? "bg-[#15120f] shadow-black/30"
                            : "border border-[#d8d1c8] bg-[#fffaf2] shadow-black/15"
                        }`}
                      />
                    ) : null}
                  </button>
                )),
              )}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#ded5c7] bg-[#fffbf4] p-3">
      <p className="text-xs font-extrabold text-[#6f685e]">{label}</p>
      <p className="mt-1 break-words text-lg font-extrabold">{value}</p>
    </div>
  );
}
