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
    const timeoutId = window.setTimeout(resolve, 5000);
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
  }

  function attachPeer(peer: RTCPeerConnection) {
    peer.onconnectionstatechange = () => {
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
      }
    };
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
                    disabled={cell !== 0 || game.winner !== 0}
                    key={`${rowIndex}-${colIndex}`}
                    onClick={() => handleMove(rowIndex, colIndex)}
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
