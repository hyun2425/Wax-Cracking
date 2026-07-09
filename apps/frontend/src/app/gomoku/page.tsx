"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Cell = 0 | 1 | 2;
type Role = 0 | 1 | 2;
type ConnectionState = "idle" | "creating" | "waiting" | "connected" | "closed";

type GameState = {
  board: Cell[][];
  status: string;
  turn: 1 | 2;
  winner: Cell;
  you: Role;
};

type PeerMessage =
  | { col: number; player: 1 | 2; row: number; type: "move" }
  | { type: "reset" };

const boardSize = 15;
const peerConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function makeEmptyBoard() {
  return Array.from({ length: boardSize }, () =>
    Array.from({ length: boardSize }, () => 0 as Cell),
  );
}

function initialGame(): GameState {
  return {
    board: makeEmptyBoard(),
    status: "서버 없이 연결하려면 초대 데이터를 만들거나 상대의 초대 데이터를 붙여넣어 주세요.",
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
  return "관전";
}

function encodeSignal(description: RTCSessionDescriptionInit) {
  return window.btoa(JSON.stringify(description));
}

function decodeSignal(value: string) {
  return JSON.parse(window.atob(value.trim())) as RTCSessionDescriptionInit;
}

function waitForIceGathering(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(resolve, 10000);
    peer.addEventListener("icegatheringstatechange", () => {
      if (peer.iceGatheringState === "complete") {
        window.clearTimeout(timeoutId);
        resolve();
      }
    });
  });
}

function countDirection(
  board: Cell[][],
  row: number,
  col: number,
  rowStep: number,
  colStep: number,
  player: Cell,
) {
  let count = 0;
  let nextRow = row + rowStep;
  let nextCol = col + colStep;

  while (
    nextRow >= 0 &&
    nextRow < boardSize &&
    nextCol >= 0 &&
    nextCol < boardSize &&
    board[nextRow][nextCol] === player
  ) {
    count++;
    nextRow += rowStep;
    nextCol += colStep;
  }

  return count;
}

function hasFive(board: Cell[][], row: number, col: number, player: Cell) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  return directions.some(([rowStep, colStep]) => {
    const count =
      1 +
      countDirection(board, row, col, rowStep, colStep, player) +
      countDirection(board, row, col, -rowStep, -colStep, player);
    return count >= 5;
  });
}

function applyMove(game: GameState, row: number, col: number, player: 1 | 2): GameState {
  if (
    game.winner !== 0 ||
    game.turn !== player ||
    row < 0 ||
    row >= boardSize ||
    col < 0 ||
    col >= boardSize ||
    game.board[row][col] !== 0
  ) {
    return game;
  }

  const board = game.board.map((line) => [...line]);
  board[row][col] = player;
  const winner: Cell = hasFive(board, row, col, player) ? player : 0;
  const turn: 1 | 2 = player === 1 ? 2 : 1;

  return {
    ...game,
    board,
    status: winner ? `${stoneName(winner)} 승리!` : `${stoneName(turn)} 차례입니다.`,
    turn,
    winner,
  };
}

export default function GomokuPage() {
  const [game, setGame] = useState<GameState>(() => initialGame());
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [inviteData, setInviteData] = useState("");
  const [remoteInviteData, setRemoteInviteData] = useState("");
  const [answerData, setAnswerData] = useState("");
  const [remoteAnswerData, setRemoteAnswerData] = useState("");
  const [notice, setNotice] = useState("");
  const [peerDetail, setPeerDetail] = useState("연결 전");
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const roleRef = useRef<Role>(0);

  useEffect(() => {
    return () => {
      channelRef.current?.close();
      peerRef.current?.close();
    };
  }, []);

  function resetPeer() {
    channelRef.current?.close();
    peerRef.current?.close();
    channelRef.current = null;
    peerRef.current = null;
    roleRef.current = 0;
    setPeerDetail("연결 전");
  }

  function attachPeer(peer: RTCPeerConnection) {
    const updatePeerDetail = () => {
      setPeerDetail(
        `WebRTC ${peer.connectionState} / ICE ${peer.iceConnectionState} / 후보 ${peer.iceGatheringState}`,
      );
    };

    peer.oniceconnectionstatechange = () => {
      updatePeerDetail();

      if (peer.iceConnectionState === "failed") {
        setNotice("브라우저끼리 직접 연결하지 못했습니다. 다른 와이파이나 핫스팟으로 시도해 보거나, 초대/응답 데이터를 새로 만들어 주세요.");
      }
    };
    peer.onicegatheringstatechange = updatePeerDetail;
    peer.onsignalingstatechange = updatePeerDetail;
    peer.onconnectionstatechange = () => {
      updatePeerDetail();
      if (peer.connectionState === "connected") {
        setConnection("connected");
        setNotice("상대와 연결됐습니다.");
        setGame((current) => ({
          ...current,
          status: current.winner ? current.status : `${stoneName(current.turn)} 차례입니다.`,
        }));
      }

      if (["closed", "failed", "disconnected"].includes(peer.connectionState)) {
        setConnection("closed");
        if (peer.connectionState === "failed") {
          setNotice("직접 연결에 실패했습니다. 회사/학교망, 일부 모바일망, VPN에서는 서버 없는 연결이 막힐 수 있습니다.");
        }
      }
    };

    updatePeerDetail();
  }

  function attachChannel(channel: RTCDataChannel) {
    channelRef.current = channel;
    channel.onopen = () => {
      setConnection("connected");
      setNotice("상대와 연결됐습니다.");
      setGame((current) => ({
        ...current,
        status: `${stoneName(current.turn)} 차례입니다.`,
      }));
    };
    channel.onclose = () => setConnection("closed");
    channel.onmessage = (event) => {
      const message = JSON.parse(event.data) as PeerMessage;
      if (message.type === "reset") {
        setGame({
          ...initialGame(),
          status: "새 판입니다. 검은 돌부터 시작하세요.",
          you: roleRef.current,
        });
        return;
      }

      setGame((current) =>
        applyMove(current, message.row, message.col, message.player),
      );
    };
  }

  function sendPeer(message: PeerMessage) {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") {
      setNotice("아직 상대와 직접 연결되지 않았습니다.");
      return false;
    }

    channel.send(JSON.stringify(message));
    return true;
  }

  async function createInvite() {
    resetPeer();
    setConnection("creating");
    setNotice("초대 데이터를 만드는 중입니다.");
    setInviteData("");
    setAnswerData("");
    setRemoteAnswerData("");
    roleRef.current = 1;
    setGame({
      ...initialGame(),
      status: "상대에게 초대 데이터를 보내고, 받은 응답 데이터를 아래에 붙여넣어 주세요.",
      you: 1,
    });

    const peer = new RTCPeerConnection(peerConfig);
    peerRef.current = peer;
    attachPeer(peer);
    attachChannel(peer.createDataChannel("gomoku"));

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await waitForIceGathering(peer);

    if (peer.localDescription) {
      setInviteData(encodeSignal(peer.localDescription.toJSON()));
      setConnection("waiting");
      setNotice("초대 데이터를 복사해서 상대에게 보내주세요.");
    }
  }

  async function acceptInvite() {
    try {
      resetPeer();
      setConnection("creating");
      setNotice("응답 데이터를 만드는 중입니다.");
      setAnswerData("");
      roleRef.current = 2;
      setGame({
        ...initialGame(),
        status: "응답 데이터를 상대에게 보내면 연결이 시작됩니다.",
        you: 2,
      });

      const peer = new RTCPeerConnection(peerConfig);
      peerRef.current = peer;
      attachPeer(peer);
      peer.ondatachannel = (event) => attachChannel(event.channel);

      await peer.setRemoteDescription(decodeSignal(remoteInviteData));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await waitForIceGathering(peer);

      if (peer.localDescription) {
        setAnswerData(encodeSignal(peer.localDescription.toJSON()));
        setConnection("waiting");
        setNotice("응답 데이터를 복사해서 초대한 사람에게 보내주세요.");
      }
    } catch {
      setConnection("closed");
      setNotice("초대 데이터를 읽지 못했습니다. 전체 내용을 다시 복사해서 붙여넣어 주세요.");
    }
  }

  async function finishInvite() {
    const peer = peerRef.current;
    if (!peer) {
      setNotice("먼저 초대 데이터를 만들어 주세요.");
      return;
    }

    try {
      await peer.setRemoteDescription(decodeSignal(remoteAnswerData));
      setNotice("응답 데이터를 적용했습니다. 연결을 기다리는 중입니다.");
      setConnection("waiting");
    } catch {
      setNotice("응답 데이터를 읽지 못했습니다. 전체 내용을 다시 복사해서 붙여넣어 주세요.");
    }
  }

  async function copyText(value: string, message: string) {
    await navigator.clipboard.writeText(value);
    setNotice(message);
  }

  function handleMove(row: number, col: number) {
    if (connection !== "connected") {
      setNotice("먼저 상대와 연결해 주세요.");
      return;
    }

    const player = roleRef.current;
    if (player !== 1 && player !== 2) {
      setNotice("내 돌이 아직 정해지지 않았습니다.");
      return;
    }

    if (game.turn !== player) {
      setNotice(`지금은 ${stoneName(game.turn)} 차례입니다.`);
      return;
    }

    const sent = sendPeer({ col, player, row, type: "move" });
    if (sent) {
      setGame((current) => applyMove(current, row, col, player));
      setNotice("");
    }
  }

  function resetGame() {
    sendPeer({ type: "reset" });
    setGame({
      ...initialGame(),
      status: "새 판입니다. 검은 돌부터 시작하세요.",
      you: roleRef.current,
    });
  }

  const connectionLabel =
    connection === "connected"
      ? "직접 연결됨"
      : connection === "creating"
        ? "생성 중"
        : connection === "waiting"
          ? "상대 대기"
          : connection === "closed"
            ? "연결 끊김"
            : "대기";
  const turnLabel = game.winner ? "게임 종료" : stoneName(game.turn);
  const myStone = stoneName(game.you);

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

      <section className="mx-auto grid w-[min(1180px,calc(100%-32px))] grid-cols-[minmax(300px,0.78fr)_minmax(360px,1fr)] gap-8 py-10 max-lg:grid-cols-1">
        <aside className="space-y-4">
          <div className="rounded-lg border border-[#ded5c7] bg-white p-5 shadow-sm">
            <p className="text-sm font-extrabold uppercase text-[#2f7f6f]">
              Serverless Gomoku
            </p>
            <h1 className="mt-2 text-4xl font-extrabold leading-tight">
              서버 없이 오목
            </h1>
            <p className="mt-4 text-sm leading-6 text-[#6f685e]">
              돈 드는 백엔드 없이 두 브라우저를 직접 연결합니다. 한 번만
              초대 데이터와 응답 데이터를 주고받으면 실시간으로 둘 수 있습니다.
            </p>
          </div>

          <div className="rounded-lg border border-[#ded5c7] bg-white p-5 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <Status label="연결" value={connectionLabel} />
              <Status label="내 돌" value={myStone} />
              <Status label="차례" value={turnLabel} />
              <Status label="상태" value={game.winner ? "종료" : "진행"} />
            </div>
            <div className="mt-3 rounded-lg border border-[#e8dece] bg-[#fffaf2] p-3">
              <p className="text-xs font-extrabold text-[#6f685e]">연결 상세</p>
              <p className="mt-1 break-words text-sm font-bold text-[#4f473d]">
                {peerDetail}
              </p>
            </div>
            <div className="mt-4 rounded-lg bg-[#f7f4ed] p-4">
              <p className="text-sm font-extrabold text-[#6f685e]">현재 상태</p>
              <p className="mt-2 text-lg font-extrabold">{game.status}</p>
            </div>
            {notice ? (
              <p className="mt-4 rounded-lg border border-[#f0d5a8] bg-[#fff8ea] p-3 text-sm font-bold text-[#7a5618]">
                {notice}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-[#ded5c7] bg-white p-5 shadow-sm">
            <h2 className="text-xl font-extrabold">내가 초대하기</h2>
            <button
              className="mt-4 min-h-11 w-full rounded-lg bg-[#191611] px-4 text-sm font-extrabold text-white"
              onClick={createInvite}
              type="button"
            >
              초대 데이터 만들기
            </button>
            <SignalBox
              label="상대에게 보낼 초대 데이터"
              onCopy={() => copyText(inviteData, "초대 데이터를 복사했습니다.")}
              readOnly
              value={inviteData}
            />
            <SignalBox
              label="상대가 보내준 응답 데이터"
              onChange={setRemoteAnswerData}
              value={remoteAnswerData}
            />
            <button
              className="mt-3 min-h-11 w-full rounded-lg border border-[#bdd7d0] bg-[#edf8f4] px-4 text-sm font-extrabold text-[#1f6156]"
              onClick={finishInvite}
              type="button"
            >
              응답 데이터 적용
            </button>
          </div>

          <div className="rounded-lg border border-[#ded5c7] bg-white p-5 shadow-sm">
            <h2 className="text-xl font-extrabold">초대받기</h2>
            <SignalBox
              label="상대가 보내준 초대 데이터"
              onChange={setRemoteInviteData}
              value={remoteInviteData}
            />
            <button
              className="mt-3 min-h-11 w-full rounded-lg bg-[#191611] px-4 text-sm font-extrabold text-white"
              onClick={acceptInvite}
              type="button"
            >
              응답 데이터 만들기
            </button>
            <SignalBox
              label="상대에게 보낼 응답 데이터"
              onCopy={() => copyText(answerData, "응답 데이터를 복사했습니다.")}
              readOnly
              value={answerData}
            />
          </div>
        </aside>

        <section className="rounded-lg border border-[#d8ccbb] bg-[#fbf0d7] p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start">
            <div>
              <p className="text-sm font-extrabold text-[#6f685e]">차례</p>
              <p className="text-2xl font-extrabold">{turnLabel}</p>
            </div>
            <button
              className="min-h-11 rounded-lg border border-[#bfae94] bg-white px-4 text-sm font-extrabold"
              onClick={resetGame}
              type="button"
            >
              새 판 시작
            </button>
          </div>

          <div className="mx-auto aspect-square w-full max-w-[720px] rounded-lg border border-[#8c6635] bg-[#d8a24d] p-[7%] shadow-[inset_0_0_0_2px_rgba(255,237,181,0.32),inset_16px_0_40px_rgba(255,231,143,0.28),inset_-18px_0_36px_rgba(103,63,22,0.16),0_12px_28px_rgba(69,47,22,0.18)]">
            <div className="relative h-full w-full">
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full"
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
              >
                <defs>
                  <linearGradient id="gomokuWood" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0" stopColor="#d39a43" />
                    <stop offset="0.32" stopColor="#efc86f" />
                    <stop offset="0.66" stopColor="#dca84f" />
                    <stop offset="1" stopColor="#f1cd78" />
                  </linearGradient>
                  <pattern
                    height="7"
                    id="gomokuGrain"
                    patternUnits="userSpaceOnUse"
                    width="13"
                  >
                    <path
                      d="M0 2 C3 1, 5 4, 8 2 S12 1, 13 3"
                      fill="none"
                      stroke="#a46d2c"
                      strokeOpacity="0.18"
                      strokeWidth="0.22"
                    />
                    <path
                      d="M1 6 C4 4, 7 7, 12 5"
                      fill="none"
                      stroke="#fff1b2"
                      strokeOpacity="0.22"
                      strokeWidth="0.18"
                    />
                  </pattern>
                </defs>
                <rect fill="url(#gomokuWood)" height="100" width="100" />
                <rect fill="url(#gomokuGrain)" height="100" width="100" />
                {Array.from({ length: boardSize }, (_, index) => {
                  const position = (index / (boardSize - 1)) * 100;
                  return (
                    <g key={index}>
                      <line
                        stroke="#2c2118"
                        strokeWidth={index === 0 || index === boardSize - 1 ? 0.72 : 0.42}
                        x1={position}
                        x2={position}
                        y1="0"
                        y2="100"
                      />
                      <line
                        stroke="#2c2118"
                        strokeWidth={index === 0 || index === boardSize - 1 ? 0.72 : 0.42}
                        x1="0"
                        x2="100"
                        y1={position}
                        y2={position}
                      />
                    </g>
                  );
                })}
              </svg>
              {[
                [3, 3],
                [3, 11],
                [7, 7],
                [11, 3],
                [11, 11],
              ].map(([row, col]) => (
                <span
                  className="pointer-events-none absolute z-0 block aspect-square w-[1.55%] min-w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#211711]"
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
                    aria-label={`${rowIndex + 1}행 ${colIndex + 1}열`}
                    className="absolute z-10 flex aspect-square w-[8.4%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-[#b33d21] disabled:cursor-default"
                    disabled={cell !== 0 || game.winner !== 0}
                    key={`${rowIndex}-${colIndex}`}
                    onClick={() => handleMove(rowIndex, colIndex)}
                    style={{
                      left: `${(colIndex / (boardSize - 1)) * 100}%`,
                      top: `${(rowIndex / (boardSize - 1)) * 100}%`,
                    }}
                    type="button"
                  >
                    {cell !== 0 ? (
                      <span
                        className={`block aspect-square w-[82%] rounded-full shadow-[0_5px_8px_rgba(32,22,10,0.34),inset_-4px_-5px_8px_rgba(0,0,0,0.24),inset_3px_4px_7px_rgba(255,255,255,0.28)] ${
                          cell === 1
                            ? "bg-[radial-gradient(circle_at_32%_28%,#4f4b48_0,#171511_42%,#050504_100%)]"
                            : "border border-[#d8d1c8] bg-[radial-gradient(circle_at_30%_24%,#ffffff_0,#f6f1e8_45%,#cfc7bb_100%)]"
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

function SignalBox({
  label,
  onChange,
  onCopy,
  readOnly = false,
  value,
}: {
  label: string;
  onChange?: (value: string) => void;
  onCopy?: () => void;
  readOnly?: boolean;
  value: string;
}) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-sm font-extrabold text-[#4f473d]">{label}</label>
        {onCopy ? (
          <button
            className="rounded-lg border border-[#d7ccba] bg-white px-3 py-2 text-xs font-extrabold disabled:opacity-45"
            disabled={!value}
            onClick={onCopy}
            type="button"
          >
            복사
          </button>
        ) : null}
      </div>
      <textarea
        className="min-h-28 w-full resize-y rounded-lg border border-[#d7ccba] bg-[#fffaf2] p-3 text-xs font-bold leading-5 outline-none focus:border-[#2f7f6f]"
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        value={value}
      />
    </div>
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
