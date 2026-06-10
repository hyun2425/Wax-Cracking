"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Stage =
  | "intro"
  | "secondFloor"
  | "livingRoom"
  | "leashShelf"
  | "leashMission"
  | "leashZoom"
  | "poopBag"
  | "garden"
  | "gateCalm"
  | "neighborhood"
  | "rubyPull"
  | "carStop"
  | "poopCleanup"
  | "clear"
  | "fail";

type DogKey = "ruby" | "gamja";
type CarStep = "stop" | "sit";

const photos = {
  rubyClose: "/ruby-gamja/ruby-close.jpg",
  gamjaLying: "/ruby-gamja/gamja-lying.jpg",
  gamjaFront: "/ruby-gamja/gamja-front.jpg",
  pairBed: "/ruby-gamja/ruby-gamja-bed.jpg",
  rubySit: "/ruby-gamja/ruby-sit.jpg",
  rubyCrate: "/ruby-gamja/ruby-crate.jpg",
  rubyHappy: "/ruby-gamja/ruby-happy.jpg",
  rubyCrateSide: "/ruby-gamja/ruby-crate-side.jpg",
};

const callWords = ["루비", "감자", "산책", "나가자"];

const stageCopy: Record<Stage, { mission: string; scene: string; backdrop: string }> = {
  intro: {
    mission: "Start 버튼을 눌러 루비와 감자의 산책을 시작하세요.",
    scene: "우리집 산책 준비",
    backdrop: photos.pairBed,
  },
  secondFloor: {
    mission: "2층에서 계단을 내려가 1층으로 가세요.",
    scene: "우리집 2층",
    backdrop: photos.rubyHappy,
  },
  livingRoom: {
    mission: "산책을 가기 위해 강아지를 불러보세요.",
    scene: "1층 거실",
    backdrop: photos.gamjaLying,
  },
  leashShelf: {
    mission: "목줄 2개를 챙기고, 먼저 '앉아'라고 말해 강아지들을 앉히세요.",
    scene: "현관 선반",
    backdrop: photos.rubyCrate,
  },
  leashMission: {
    mission: "10초 안에 루비와 감자 목을 클릭한 뒤 확대 화면에서 목줄을 드래그해 채우세요.",
    scene: "목줄 채우기",
    backdrop: photos.rubySit,
  },
  leashZoom: {
    mission: "목줄을 강아지 목의 반짝이는 고리까지 드래그하세요.",
    scene: "목줄 확대",
    backdrop: photos.rubySit,
  },
  poopBag: {
    mission: "문 옆 똥봉투를 챙긴 뒤 정원으로 나가세요.",
    scene: "현관문 앞",
    backdrop: photos.rubyCrateSide,
  },
  garden: {
    mission: "대문 앞에서 루비와 감자의 흥분을 먼저 가라앉히세요.",
    scene: "우리집 정원",
    backdrop: photos.rubyHappy,
  },
  gateCalm: {
    mission: "루비에게 '앉아', 감자에게 '조용히 해'를 입력해 진정시킨 뒤 대문을 여세요.",
    scene: "대문 앞",
    backdrop: photos.rubyHappy,
  },
  neighborhood: {
    mission: "동네 한 바퀴를 안전하게 완료하세요.",
    scene: "동네 산책길",
    backdrop: photos.rubyClose,
  },
  rubyPull: {
    mission: "루비가 앞으로 당겨요. 5초 안에 '천천히'를 입력하세요.",
    scene: "대문 밖 골목",
    backdrop: photos.rubyClose,
  },
  carStop: {
    mission: "차가 옵니다. 먼저 '멈춰', 다음 '앉아'를 입력하세요.",
    scene: "횡단 골목",
    backdrop: photos.rubyClose,
  },
  poopCleanup: {
    mission: "감자가 똥을 쌌어요. 똥봉투로 치워주세요.",
    scene: "산책길 중간",
    backdrop: photos.gamjaFront,
  },
  clear: {
    mission: "산책 완료! 루비와 감자가 행복해 보여요.",
    scene: "집으로 돌아오는 길",
    backdrop: photos.pairBed,
  },
  fail: {
    mission: "산책 실패... 다시 도전해볼까요?",
    scene: "다시 도전",
    backdrop: photos.pairBed,
  },
};

export default function WalkQuestGame() {
  const [stage, setStage] = useState<Stage>("intro");
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("루비와 감자가 오늘 산책을 기다리고 있어요.");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [falls, setFalls] = useState(0);
  const [danger, setDanger] = useState(0);
  const [walkProgress, setWalkProgress] = useState(0);
  const [hasLeashes, setHasLeashes] = useState(false);
  const [dogsSitting, setDogsSitting] = useState(false);
  const [rubyLeashed, setRubyLeashed] = useState(false);
  const [gamjaLeashed, setGamjaLeashed] = useState(false);
  const [zoomDog, setZoomDog] = useState<DogKey | null>(null);
  const [hasPoopBag, setHasPoopBag] = useState(false);
  const [rubyCalmed, setRubyCalmed] = useState(false);
  const [gamjaQuieted, setGamjaQuieted] = useState(false);
  const [rubyPullHandled, setRubyPullHandled] = useState(false);
  const [carHandled, setCarHandled] = useState(false);
  const [poopHandled, setPoopHandled] = useState(false);
  const [carStep, setCarStep] = useState<CarStep>("stop");
  const [peeFlash, setPeeFlash] = useState(false);

  const commandPlaceholder = useMemo(() => {
    if (stage === "livingRoom") return "루비 / 감자 / 산책 / 나가자";
    if (stage === "leashShelf") return "앉아";
    if (stage === "gateCalm") return rubyCalmed ? "조용히 해" : "앉아";
    if (stage === "rubyPull") return "천천히";
    if (stage === "carStop") return carStep === "stop" ? "멈춰" : "앉아";
    return "명령어 입력";
  }, [carStep, rubyCalmed, stage]);

  const canUseCommand = ["livingRoom", "leashShelf", "gateCalm", "rubyPull", "carStop"].includes(stage);

  useEffect(() => {
    if (!["leashMission", "leashZoom", "rubyPull", "carStop"].includes(stage) || timeLeft === null) return;

    if (timeLeft <= 0) {
      if (stage === "leashMission" || stage === "leashZoom") {
        resetLeashAttempt("시간이 지나서 루비와 감자가 다시 일어나 점프해요. 다시 '앉아'부터 해주세요.");
        return;
      }
      if (stage === "rubyPull") {
        handleFall("루비가 갑자기 당겨서 중심을 잃었어요.");
        return;
      }
      addDanger("시간 안에 안전 명령을 하지 못했어요.");
      return;
    }

    const timer = window.setTimeout(() => {
      setTimeLeft((current) => (current === null ? null : current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
    // Timeout branches intentionally use the current game snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, timeLeft]);

  useEffect(() => {
    if (stage !== "neighborhood") return;

    const progressTimer = window.setInterval(() => {
      setWalkProgress((current) => {
        const next = Math.min(100, current + 4);
        if (next >= 100) {
          window.clearInterval(progressTimer);
          setStage("clear");
          setMessage("산책 완료! 루비와 감자가 행복해 보여요.");
        }
        return next;
      });
    }, 1300);

    const timers: number[] = [];

    if (!rubyPullHandled) {
      timers.push(
        window.setTimeout(() => {
          setStage("rubyPull");
          setTimeLeft(5);
          setMessage("대문 밖이라 루비가 신나서 앞으로 당겨요. '천천히'!");
        }, 5000),
      );
    }

    if (!poopHandled) {
      timers.push(
        window.setTimeout(() => {
          setStage("poopCleanup");
          setMessage("감자가 멈춰서 똥을 쌌어요. 챙긴 똥봉투로 치워주세요.");
        }, 9500),
      );
    }

    if (!carHandled) {
      timers.push(
        window.setTimeout(() => {
          setStage("carStop");
          setCarStep("stop");
          setTimeLeft(8);
          setMessage("자동차가 골목으로 들어와요. 먼저 '멈춰'!");
        }, 14500),
      );
    }

    const peeTimer = window.setInterval(() => {
      setPeeFlash(true);
      setMessage("감자가 잠깐 멈춰서 오줌을 싸요. 기다려 주세요.");
      window.setTimeout(() => {
        setPeeFlash(false);
        setMessage("좋아요. 다시 산책을 이어가요.");
      }, 2400);
    }, 30000);

    return () => {
      window.clearInterval(progressTimer);
      window.clearInterval(peeTimer);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [carHandled, poopHandled, rubyPullHandled, stage]);

  function resetGame() {
    setInput("");
    setTimeLeft(null);
    setFalls(0);
    setDanger(0);
    setWalkProgress(0);
    setHasLeashes(false);
    setDogsSitting(false);
    setRubyLeashed(false);
    setGamjaLeashed(false);
    setZoomDog(null);
    setHasPoopBag(false);
    setRubyCalmed(false);
    setGamjaQuieted(false);
    setRubyPullHandled(false);
    setCarHandled(false);
    setPoopHandled(false);
    setCarStep("stop");
    setPeeFlash(false);
  }

  function startGame() {
    resetGame();
    setStage("secondFloor");
    setMessage("2층입니다. 계단 아래에서 루비와 감자가 조용히 쉬고 있어요.");
  }

  function fail(reason: string) {
    setStage("fail");
    setTimeLeft(null);
    setZoomDog(null);
    setMessage(reason);
  }

  function handleFall(reason: string) {
    const nextFalls = falls + 1;
    setFalls(nextFalls);
    setTimeLeft(null);
    if (nextFalls >= 3) {
      fail(`${reason} 3번 넘어져서 산책을 계속할 수 없어요.`);
      return;
    }
    setRubyPullHandled(true);
    setStage("neighborhood");
    setMessage(`${reason} 넘어짐 ${nextFalls}/3. 목줄을 짧게 잡고 다시 걸어요.`);
  }

  function addDanger(reason: string) {
    const nextDanger = Math.min(100, danger + 34);
    setDanger(nextDanger);
    setTimeLeft(null);
    setCarHandled(true);
    if (nextDanger >= 100) {
      fail(`${reason} 위험 게이지가 가득 찼어요.`);
      return;
    }
    setStage("neighborhood");
    setMessage(`${reason} 위험 게이지가 올랐어요. 다음에는 더 침착하게요.`);
  }

  function resetLeashAttempt(reason: string) {
    setDogsSitting(false);
    setRubyLeashed(false);
    setGamjaLeashed(false);
    setZoomDog(null);
    setTimeLeft(null);
    setStage("leashShelf");
    setMessage(reason);
  }

  function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const command = input.trim();
    if (!command) return;

    if (stage === "livingRoom") {
      if (callWords.includes(command)) {
        setStage("leashShelf");
        setMessage("루비와 감자가 달려오고 꼬리를 흔들어요. 선반에서 목줄을 챙기세요.");
      } else {
        setMessage("강아지들이 아직 반응하지 않아요.");
      }
    }

    if (stage === "leashShelf") {
      if (command === "앉아") {
        setDogsSitting(true);
        setMessage("루비와 감자가 앉았어요. 이제 목줄 채우기 미션을 시작할 수 있어요.");
      } else {
        setMessage("목줄을 채우기 전에는 먼저 '앉아'라고 말해야 해요.");
      }
    }

    if (stage === "gateCalm") {
      if (command === "앉아") {
        setRubyCalmed(true);
        setMessage(gamjaQuieted ? "루비도 앉았고 감자도 조용해요. 이제 대문을 열 수 있어요." : "루비가 빙글빙글 돌다가 앉았어요. 감자에게는 '조용히 해'가 필요해요.");
      } else if (command === "조용히 해") {
        setGamjaQuieted(true);
        setMessage(rubyCalmed ? "루비도 앉았고 감자도 조용해요. 이제 대문을 열 수 있어요." : "감자가 짖음을 멈췄어요. 루비를 '앉아'로 진정시켜야 해요.");
      } else {
        setMessage("대문 앞에서는 루비에게 '앉아', 감자에게 '조용히 해'가 필요해요.");
      }
    }

    if (stage === "rubyPull") {
      if (command === "천천히") {
        setRubyPullHandled(true);
        setTimeLeft(null);
        setStage("neighborhood");
        setMessage("루비가 속도를 줄였어요. 감자도 옆에서 잘 따라와요.");
      } else {
        handleFall("루비가 더 세게 당겼어요.");
      }
    }

    if (stage === "carStop") {
      if (carStep === "stop" && command === "멈춰") {
        setCarStep("sit");
        setTimeLeft(6);
        setMessage("둘 다 멈췄어요. 이제 '앉아'!");
      } else if (carStep === "sit" && command === "앉아") {
        setCarHandled(true);
        setTimeLeft(null);
        setStage("neighborhood");
        setMessage("차가 지나갈 때까지 루비와 감자가 안전하게 앉아 기다렸어요.");
      } else {
        addDanger("명령 순서가 흔들렸어요.");
      }
    }

    setInput("");
  }

  function clickAction(action: string, dog?: DogKey) {
    if (action === "stairs") {
      setStage("livingRoom");
      setMessage("1층 거실입니다. 루비와 감자를 불러보세요.");
      return;
    }

    if (action === "leashes") {
      setHasLeashes(true);
      setMessage("목줄 2개를 챙겼어요. 이제 '앉아'라고 말해 강아지들을 앉히세요.");
      return;
    }

    if (action === "startLeash") {
      if (!hasLeashes) {
        setMessage("먼저 선반에서 목줄 2개를 챙겨야 해요.");
        return;
      }
      if (!dogsSitting) {
        setMessage("먼저 강아지들을 앉혀야 해요!");
        return;
      }
      setStage("leashMission");
      setTimeLeft(10);
      setMessage("털이 끼지 않게 조심해서 채워주세요. 강아지 목을 클릭하면 확대됩니다.");
      return;
    }

    if (action === "openZoom" && dog) {
      if (!dogsSitting) {
        setMessage("강아지들이 다시 일어나기 전에 '앉아'가 필요해요.");
        return;
      }
      if ((dog === "ruby" && rubyLeashed) || (dog === "gamja" && gamjaLeashed)) {
        setMessage(`${dog === "ruby" ? "루비" : "감자"}는 이미 목줄을 찼어요.`);
        return;
      }
      setZoomDog(dog);
      setStage("leashZoom");
      setMessage(`${dog === "ruby" ? "루비" : "감자"} 목이 확대됐어요. 목줄을 고리까지 드래그하세요.`);
      return;
    }

    if (action === "poopBag") {
      setHasPoopBag(true);
      setMessage("똥봉투를 챙겼어요. 이제 정원으로 나갈 수 있어요.");
      return;
    }

    if (action === "toGarden") {
      if (!hasPoopBag) {
        setMessage("뭐 잊은 게 있지 않나? 똥봉투를 챙겨야 해요.");
        return;
      }
      setStage("garden");
      setMessage("정원에 나왔어요. 대문 앞에서 루비가 빙글빙글 돌고 감자가 짖기 시작해요.");
      return;
    }

    if (action === "gate") {
      setStage("gateCalm");
      setMessage("루비가 신나서 빙글빙글 돌아요. 감자는 짖고 있어요. 바로 열면 넘어질 수 있어요.");
      return;
    }

    if (action === "openGate") {
      if (!rubyCalmed || !gamjaQuieted) {
        handleFall("흥분한 루비와 짖는 감자 때문에 대문 앞에서 넘어졌어요.");
        return;
      }
      setStage("neighborhood");
      setMessage("대문을 열고 동네 산책을 시작합니다. 목줄을 단단히 잡아요.");
      return;
    }

    if (action === "cleanPoop") {
      if (!hasPoopBag) {
        setMessage("똥봉투가 없어서 치울 수 없어요.");
        return;
      }
      setPoopHandled(true);
      setStage("neighborhood");
      setMessage("감자 똥을 깔끔하게 치웠어요. 산책 매너 최고!");
      return;
    }
  }

  function finishLeashDog(dog: DogKey) {
    if (dog === "ruby") setRubyLeashed(true);
    if (dog === "gamja") setGamjaLeashed(true);

    const nextRuby = dog === "ruby" || rubyLeashed;
    const nextGamja = dog === "gamja" || gamjaLeashed;

    setZoomDog(null);
    if (nextRuby && nextGamja) {
      setTimeLeft(null);
      setStage("poopBag");
      setMessage("루비와 감자 모두 목줄을 찼어요. 이제 똥봉투를 챙기세요.");
      return;
    }

    setStage("leashMission");
    setMessage(`${dog === "ruby" ? "루비" : "감자"} 목줄 성공! 다른 강아지도 목을 클릭해서 채워주세요.`);
  }

  const currentCopy = stageCopy[stage];

  return (
    <main className="walk-page">
      <Link className="back-link" href="/">
        ← 왁뿌볼로 돌아가기
      </Link>

      <section className="game-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">1인칭 산책 시뮬레이션</p>
            <h1>루비 감자와 산책</h1>
          </div>
          <div className="meters" aria-label="게임 상태">
            <StatusPill label="시간" value={timeLeft === null ? "∞" : `${timeLeft}s`} alert={timeLeft !== null && timeLeft <= 3} />
            <StatusPill label="넘어짐" value={`${falls}/3`} alert={falls > 0} />
            <StatusPill label="위험" value={`${danger}%`} alert={danger >= 68} />
            <StatusPill label="진행" value={`${walkProgress}%`} />
          </div>
        </header>

        <GameView
          stage={stage}
          copy={currentCopy}
          message={message}
          input={input}
          setInput={setInput}
          submitCommand={submitCommand}
          canUseCommand={canUseCommand}
          commandPlaceholder={commandPlaceholder}
          hasLeashes={hasLeashes}
          dogsSitting={dogsSitting}
          rubyLeashed={rubyLeashed}
          gamjaLeashed={gamjaLeashed}
          hasPoopBag={hasPoopBag}
          rubyCalmed={rubyCalmed}
          gamjaQuieted={gamjaQuieted}
          zoomDog={zoomDog}
          peeFlash={peeFlash}
          clickAction={clickAction}
          finishLeashDog={finishLeashDog}
          startGame={startGame}
        />

        <aside className="hud">
          <div>
            <b>현재 미션</b>
            <p>{currentCopy.mission}</p>
          </div>
          <Inventory
            hasLeashes={hasLeashes}
            dogsSitting={dogsSitting}
            rubyLeashed={rubyLeashed}
            gamjaLeashed={gamjaLeashed}
            hasPoopBag={hasPoopBag}
          />
        </aside>
      </section>

      <style jsx>{`
        .walk-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.9), transparent 28rem),
            linear-gradient(135deg, #efe6da 0%, #d7e7e2 100%);
          color: #251d18;
          padding: 24px;
        }

        .back-link {
          color: #5b3f2e;
          font-weight: 800;
          text-decoration: none;
        }

        .game-shell {
          max-width: 1180px;
          margin: 18px auto 0;
          background: rgba(255, 252, 247, 0.92);
          border: 1px solid rgba(91, 63, 46, 0.16);
          border-radius: 22px;
          box-shadow: 0 24px 70px rgba(40, 28, 20, 0.14);
          overflow: hidden;
        }

        .topbar {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
          padding: 22px 24px 16px;
          border-bottom: 1px solid rgba(91, 63, 46, 0.12);
        }

        .eyebrow {
          margin: 0 0 6px;
          color: #8f6345;
          font-size: 0.82rem;
          font-weight: 900;
          letter-spacing: 0.04em;
        }

        h1 {
          margin: 0;
          font-size: clamp(1.65rem, 4vw, 2.65rem);
          letter-spacing: 0;
        }

        .meters {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        .hud {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          padding: 16px 24px 22px;
          background: rgba(255, 249, 240, 0.78);
        }

        .hud b {
          display: block;
          margin-bottom: 6px;
        }

        .hud p {
          margin: 0;
          color: #5d5149;
          line-height: 1.55;
        }

        @media (max-width: 820px) {
          .walk-page {
            padding: 12px;
          }

          .topbar,
          .hud {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: stretch;
          }

          .meters {
            justify-content: flex-start;
          }
        }
      `}</style>
    </main>
  );
}

function StatusPill({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <span className={alert ? "pill alert" : "pill"}>
      <small>{label}</small>
      {value}
      <style jsx>{`
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 34px;
          padding: 7px 11px;
          border-radius: 999px;
          border: 1px solid rgba(91, 63, 46, 0.16);
          background: #fffaf2;
          color: #2f261f;
          font-weight: 900;
          white-space: nowrap;
        }

        .pill small {
          color: #8a7667;
          font-size: 0.72rem;
        }

        .alert {
          background: #fff1ec;
          color: #ad3b2f;
          border-color: rgba(173, 59, 47, 0.28);
        }
      `}</style>
    </span>
  );
}

function Inventory({
  hasLeashes,
  dogsSitting,
  rubyLeashed,
  gamjaLeashed,
  hasPoopBag,
}: {
  hasLeashes: boolean;
  dogsSitting: boolean;
  rubyLeashed: boolean;
  gamjaLeashed: boolean;
  hasPoopBag: boolean;
}) {
  const items = [
    ["목줄", hasLeashes],
    ["앉아", dogsSitting],
    ["루비 목줄", rubyLeashed],
    ["감자 목줄", gamjaLeashed],
    ["똥봉투", hasPoopBag],
  ] as const;

  return (
    <div className="inventory">
      {items.map(([label, ready]) => (
        <span key={label} className={ready ? "ready" : ""}>
          {label}
        </span>
      ))}
      <style jsx>{`
        .inventory {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 7px;
        }

        span {
          padding: 7px 10px;
          border-radius: 999px;
          background: #efe7dd;
          color: #85766a;
          font-size: 0.82rem;
          font-weight: 900;
        }

        .ready {
          background: #e2f0d9;
          color: #357017;
        }

        @media (max-width: 820px) {
          .inventory {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
}

function GameView({
  stage,
  copy,
  message,
  input,
  setInput,
  submitCommand,
  canUseCommand,
  commandPlaceholder,
  hasLeashes,
  dogsSitting,
  rubyLeashed,
  gamjaLeashed,
  hasPoopBag,
  rubyCalmed,
  gamjaQuieted,
  zoomDog,
  peeFlash,
  clickAction,
  finishLeashDog,
  startGame,
}: {
  stage: Stage;
  copy: { mission: string; scene: string; backdrop: string };
  message: string;
  input: string;
  setInput: (value: string) => void;
  submitCommand: (event: FormEvent<HTMLFormElement>) => void;
  canUseCommand: boolean;
  commandPlaceholder: string;
  hasLeashes: boolean;
  dogsSitting: boolean;
  rubyLeashed: boolean;
  gamjaLeashed: boolean;
  hasPoopBag: boolean;
  rubyCalmed: boolean;
  gamjaQuieted: boolean;
  zoomDog: DogKey | null;
  peeFlash: boolean;
  clickAction: (action: string, dog?: DogKey) => void;
  finishLeashDog: (dog: DogKey) => void;
  startGame: () => void;
}) {
  const sceneClass = `scene scene-${stage}`;

  return (
    <section className={sceneClass}>
      <div className="photo-backdrop" style={{ backgroundImage: `url(${copy.backdrop})` }} />
      <div className="scene-glass" />

      <div className="scene-label">
        <span>{copy.scene}</span>
        <strong>{message}</strong>
      </div>

      {stage === "intro" && <IntroPanel startGame={startGame} />}
      {stage === "secondFloor" && <RealisticHouseStep clickAction={clickAction} />}
      {stage === "livingRoom" && <DogWakeScene />}
      {stage === "leashShelf" && <LeashShelf hasLeashes={hasLeashes} dogsSitting={dogsSitting} clickAction={clickAction} />}
      {stage === "leashMission" && (
        <LeashMission
          rubyLeashed={rubyLeashed}
          gamjaLeashed={gamjaLeashed}
          clickAction={clickAction}
        />
      )}
      {stage === "leashZoom" && zoomDog && <LeashZoom dog={zoomDog} finishLeashDog={finishLeashDog} />}
      {stage === "poopBag" && <PoopBagScene hasPoopBag={hasPoopBag} clickAction={clickAction} />}
      {stage === "garden" && <GardenScene clickAction={clickAction} />}
      {stage === "gateCalm" && <GateCalm rubyCalmed={rubyCalmed} gamjaQuieted={gamjaQuieted} clickAction={clickAction} />}
      {stage === "neighborhood" && <Neighborhood peeFlash={peeFlash} />}
      {stage === "rubyPull" && <RubyPull />}
      {stage === "carStop" && <CarWarning />}
      {stage === "poopCleanup" && <PoopCleanup clickAction={clickAction} />}
      {stage === "clear" && <ResultPanel title="산책 완료!" body="루비와 감자가 행복해 보여요." action="다시 산책하기" onClick={startGame} />}
      {stage === "fail" && <ResultPanel title="산책 실패..." body={message} action="Restart" onClick={startGame} />}

      {canUseCommand && (
        <form className="command-card" onSubmit={submitCommand}>
          <input
            aria-label="명령어 입력"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={commandPlaceholder}
            autoComplete="off"
            autoFocus
          />
          <button type="submit">말하기</button>
        </form>
      )}

      <style jsx>{`
        .scene {
          position: relative;
          min-height: 620px;
          overflow: hidden;
          background: #2d2722;
        }

        .photo-backdrop {
          position: absolute;
          inset: 0;
          background-position: center;
          background-size: cover;
          filter: saturate(0.92) contrast(1.02);
          transform: scale(1.04);
        }

        .scene-glass {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(21, 16, 13, 0.52), rgba(21, 16, 13, 0.12) 44%, rgba(21, 16, 13, 0.28)),
            radial-gradient(circle at 55% 48%, rgba(255, 250, 240, 0.2), transparent 32rem);
        }

        .scene-label {
          position: absolute;
          z-index: 3;
          top: 20px;
          left: 22px;
          right: 22px;
          display: grid;
          gap: 8px;
          max-width: 620px;
          color: #fffaf2;
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.42);
        }

        .scene-label span {
          width: fit-content;
          padding: 7px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.22);
          backdrop-filter: blur(12px);
          font-size: 0.82rem;
          font-weight: 900;
        }

        .scene-label strong {
          font-size: clamp(1.05rem, 2.2vw, 1.5rem);
          line-height: 1.35;
        }

        .command-card {
          position: absolute;
          z-index: 8;
          left: 50%;
          bottom: 24px;
          display: flex;
          width: min(560px, calc(100% - 32px));
          gap: 10px;
          padding: 10px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.32);
          background: rgba(255, 250, 242, 0.9);
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.24);
          transform: translateX(-50%);
        }

        input {
          min-width: 0;
          flex: 1;
          border: 1px solid rgba(89, 64, 45, 0.18);
          border-radius: 13px;
          padding: 13px 14px;
          font: inherit;
          font-weight: 800;
          outline: none;
        }

        input:focus {
          border-color: #8b5e3c;
          box-shadow: 0 0 0 4px rgba(139, 94, 60, 0.12);
        }

        button {
          border: 0;
          border-radius: 13px;
          padding: 0 17px;
          background: #2f6f2d;
          color: white;
          font: inherit;
          font-weight: 900;
          cursor: pointer;
        }

        @media (max-width: 720px) {
          .scene {
            min-height: 590px;
          }

          .command-card {
            flex-direction: column;
          }

          button {
            min-height: 44px;
          }
        }
      `}</style>
    </section>
  );
}

function IntroPanel({ startGame }: { startGame: () => void }) {
  return (
    <div className="intro-panel">
      <div className="hero-photo">
        <Image src={photos.pairBed} alt="루비와 감자" fill sizes="(max-width: 760px) 92vw, 520px" priority />
      </div>
      <div className="intro-copy">
        <p>오늘의 미션</p>
        <h2>루비 감자와 산책</h2>
        <span>부르기, 앉히기, 목줄 채우기, 똥 치우기, 차 피하기까지 성공해야 산책 완료!</span>
        <button onClick={startGame}>Start</button>
      </div>
      <style jsx>{`
        .intro-panel {
          position: absolute;
          z-index: 5;
          inset: 96px 7% 78px;
          display: grid;
          grid-template-columns: minmax(260px, 0.9fr) minmax(280px, 1fr);
          gap: 24px;
          align-items: center;
        }

        .hero-photo {
          position: relative;
          min-height: 390px;
          overflow: hidden;
          border-radius: 26px;
          box-shadow: 0 26px 58px rgba(0, 0, 0, 0.32);
        }

        .hero-photo :global(img) {
          object-fit: cover;
        }

        .intro-copy {
          color: #fffdf8;
          text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5);
        }

        p {
          margin: 0 0 10px;
          font-weight: 900;
          color: #f8d6b8;
        }

        h2 {
          margin: 0;
          font-size: clamp(2.6rem, 7vw, 5.4rem);
          line-height: 0.96;
          letter-spacing: 0;
        }

        span {
          display: block;
          max-width: 460px;
          margin-top: 18px;
          line-height: 1.7;
          font-weight: 800;
        }

        button {
          margin-top: 26px;
          border: 0;
          border-radius: 999px;
          padding: 15px 26px;
          background: #fff8ef;
          color: #2c211b;
          font: inherit;
          font-weight: 1000;
          cursor: pointer;
          box-shadow: 0 14px 30px rgba(0, 0, 0, 0.18);
        }

        @media (max-width: 820px) {
          .intro-panel {
            inset: 90px 18px 96px;
            grid-template-columns: 1fr;
          }

          .hero-photo {
            min-height: 260px;
          }
        }
      `}</style>
    </div>
  );
}

function RealisticHouseStep({ clickAction }: { clickAction: (action: string) => void }) {
  return (
    <div className="house-layer">
      <div className="stairwell">
        <div className="rail" />
        {Array.from({ length: 6 }).map((_, index) => (
          <button key={index} className="step" onClick={() => clickAction("stairs")} aria-label="계단 내려가기" />
        ))}
      </div>
      <button className="primary-action" onClick={() => clickAction("stairs")}>계단 내려가기</button>
      <style jsx>{`
        .house-layer {
          position: absolute;
          z-index: 4;
          inset: 0;
        }

        .stairwell {
          position: absolute;
          left: 10%;
          right: 12%;
          bottom: 0;
          height: 64%;
          perspective: 760px;
        }

        .rail {
          position: absolute;
          top: 6%;
          left: 12%;
          width: 6px;
          height: 72%;
          background: linear-gradient(#d9c5aa, #72513c);
          box-shadow: 90px 70px 0 rgba(80, 52, 35, 0.55);
          transform: rotate(-18deg);
        }

        .step {
          position: relative;
          display: block;
          width: calc(70% - var(--i, 0px));
          height: 48px;
          margin: 0 auto 11px;
          border: 0;
          border-radius: 6px;
          background: linear-gradient(180deg, #d8c2a6, #80624d);
          box-shadow: 0 16px 22px rgba(0, 0, 0, 0.24);
          transform: rotateX(54deg);
          cursor: pointer;
        }

        .step:nth-child(2) { width: 82%; }
        .step:nth-child(3) { width: 75%; }
        .step:nth-child(4) { width: 68%; }
        .step:nth-child(5) { width: 61%; }
        .step:nth-child(6) { width: 54%; }
        .step:nth-child(7) { width: 47%; }

        .primary-action {
          position: absolute;
          right: 28px;
          bottom: 28px;
          border: 0;
          border-radius: 999px;
          padding: 14px 18px;
          background: #fff8ef;
          color: #32241b;
          font: inherit;
          font-weight: 1000;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

function DogWakeScene() {
  return (
    <div className="dog-wake">
      <PhotoCard src={photos.gamjaLying} label="감자" className="gamja" />
      <PhotoCard src={photos.rubyCrate} label="루비" className="ruby" />
      <style jsx>{`
        .dog-wake {
          position: absolute;
          z-index: 4;
          inset: 112px 7% 104px;
          display: flex;
          align-items: end;
          justify-content: center;
          gap: min(5vw, 48px);
        }
      `}</style>
    </div>
  );
}

function LeashShelf({
  hasLeashes,
  dogsSitting,
  clickAction,
}: {
  hasLeashes: boolean;
  dogsSitting: boolean;
  clickAction: (action: string) => void;
}) {
  return (
    <div className="shelf-scene">
      <div className="wood-shelf">
        <button className={hasLeashes ? "leash taken" : "leash"} onClick={() => clickAction("leashes")}>
          목줄 2개
        </button>
        <button className="poop-roll" disabled>
          똥봉투는 문 옆
        </button>
      </div>
      <div className={dogsSitting ? "dogs sitting" : "dogs jumping"}>
        <PhotoCard src={photos.rubySit} label={dogsSitting ? "루비 앉음" : "루비 점프"} className="small" />
        <PhotoCard src={photos.gamjaFront} label={dogsSitting ? "감자 앉음" : "감자 신남"} className="small" />
      </div>
      <button className="primary-action" onClick={() => clickAction("startLeash")}>목줄 채우기 시작</button>
      <style jsx>{`
        .shelf-scene {
          position: absolute;
          z-index: 4;
          inset: 112px 6% 92px;
        }

        .wood-shelf {
          position: absolute;
          top: 2%;
          right: 5%;
          width: min(360px, 42vw);
          min-height: 150px;
          border-radius: 18px;
          background:
            linear-gradient(90deg, rgba(255,255,255,0.18), transparent),
            linear-gradient(180deg, #6e4b34, #3e271d);
          box-shadow: 0 20px 40px rgba(0,0,0,0.34);
          padding: 20px;
          display: grid;
          gap: 12px;
        }

        button {
          border: 0;
          border-radius: 14px;
          padding: 13px;
          font: inherit;
          font-weight: 1000;
          cursor: pointer;
        }

        .leash {
          background: #f5d2b0;
          color: #4b2817;
        }

        .taken {
          background: #d9efd0;
          color: #276512;
        }

        .poop-roll {
          background: rgba(255,255,255,0.74);
          color: #5f5148;
        }

        .dogs {
          position: absolute;
          left: 4%;
          bottom: 0;
          display: flex;
          gap: 22px;
          transition: transform 260ms ease;
        }

        .jumping {
          animation: hop 0.8s ease-in-out infinite alternate;
        }

        .primary-action {
          position: absolute;
          right: 5%;
          bottom: 0;
          background: #fff8ef;
          color: #2f251d;
          box-shadow: 0 14px 30px rgba(0,0,0,0.22);
        }

        @keyframes hop {
          from { transform: translateY(0); }
          to { transform: translateY(-14px); }
        }

        @media (max-width: 760px) {
          .wood-shelf {
            width: 88%;
            left: 6%;
            right: auto;
          }

          .dogs {
            left: 6%;
            right: 6%;
            transform: scale(0.82);
            transform-origin: bottom left;
          }
        }
      `}</style>
    </div>
  );
}

function LeashMission({
  rubyLeashed,
  gamjaLeashed,
  clickAction,
}: {
  rubyLeashed: boolean;
  gamjaLeashed: boolean;
  clickAction: (action: string, dog?: DogKey) => void;
}) {
  return (
    <div className="leash-mission">
      <button className={rubyLeashed ? "dog-target done" : "dog-target"} onClick={() => clickAction("openZoom", "ruby")}>
        <Image src={photos.rubySit} alt="루비 목 클릭" fill sizes="260px" />
        <span>루비 목 클릭</span>
      </button>
      <button className={gamjaLeashed ? "dog-target done" : "dog-target"} onClick={() => clickAction("openZoom", "gamja")}>
        <Image src={photos.gamjaFront} alt="감자 목 클릭" fill sizes="260px" />
        <span>감자 목 클릭</span>
      </button>
      <p>털이 끼지 않게 조심해서 채워주세요!</p>
      <style jsx>{`
        .leash-mission {
          position: absolute;
          z-index: 5;
          inset: 116px 6% 96px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 28px;
        }

        .dog-target {
          position: relative;
          width: min(280px, 38vw);
          height: 330px;
          overflow: hidden;
          border: 4px solid rgba(255,255,255,0.68);
          border-radius: 24px;
          background: #15120f;
          box-shadow: 0 24px 54px rgba(0,0,0,0.34);
          cursor: pointer;
        }

        .dog-target :global(img) {
          object-fit: cover;
        }

        .dog-target span {
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: 14px;
          padding: 10px 12px;
          border-radius: 999px;
          background: rgba(255,248,239,0.92);
          color: #2e241d;
          font-weight: 1000;
        }

        .done {
          border-color: #9be37a;
        }

        p {
          position: absolute;
          left: 50%;
          bottom: 0;
          margin: 0;
          transform: translateX(-50%);
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255, 248, 239, 0.9);
          color: #70442d;
          font-weight: 1000;
        }
      `}</style>
    </div>
  );
}

function LeashZoom({ dog, finishLeashDog }: { dog: DogKey; finishLeashDog: (dog: DogKey) => void }) {
  const photo = dog === "ruby" ? photos.rubySit : photos.gamjaFront;
  const name = dog === "ruby" ? "루비" : "감자";

  return (
    <div className="zoom-wrap">
      <div className="zoom-photo">
        <Image src={photo} alt={`${name} 목줄 확대`} fill sizes="620px" priority />
        <div
          className="collar-target"
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => finishLeashDog(dog)}
          aria-label={`${name} 목줄 고리`}
        >
          여기에 놓기
        </div>
      </div>
      <div
        className="drag-leash"
        draggable
        onDragStart={(event) => event.dataTransfer.setData("text/plain", dog)}
      >
        목줄 드래그
      </div>
      <style jsx>{`
        .zoom-wrap {
          position: absolute;
          z-index: 7;
          inset: 86px 5% 86px;
          display: grid;
          grid-template-columns: minmax(280px, 620px) 180px;
          align-items: center;
          justify-content: center;
          gap: 24px;
        }

        .zoom-photo {
          position: relative;
          height: min(470px, 62vh);
          overflow: hidden;
          border-radius: 28px;
          border: 1px solid rgba(255,255,255,0.35);
          box-shadow: 0 30px 74px rgba(0,0,0,0.44);
        }

        .zoom-photo :global(img) {
          object-fit: cover;
        }

        .collar-target {
          position: absolute;
          left: 50%;
          top: 59%;
          width: 142px;
          height: 82px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          border: 3px dashed rgba(255, 232, 163, 0.95);
          background: rgba(37, 29, 24, 0.3);
          color: white;
          font-weight: 1000;
          transform: translate(-50%, -50%);
          text-shadow: 0 2px 10px rgba(0,0,0,0.65);
        }

        .drag-leash {
          display: grid;
          place-items: center;
          min-height: 92px;
          border-radius: 24px;
          background:
            radial-gradient(circle at 20% 24%, rgba(255,255,255,0.55), transparent 2.2rem),
            linear-gradient(135deg, #f09a9e, #4d372d);
          color: white;
          font-weight: 1000;
          box-shadow: 0 22px 48px rgba(0,0,0,0.34);
          cursor: grab;
          user-select: none;
        }

        @media (max-width: 760px) {
          .zoom-wrap {
            grid-template-columns: 1fr;
            inset: 92px 16px 116px;
          }

          .drag-leash {
            min-height: 64px;
          }
        }
      `}</style>
    </div>
  );
}

function PoopBagScene({ hasPoopBag, clickAction }: { hasPoopBag: boolean; clickAction: (action: string) => void }) {
  return (
    <div className="poopbag-scene">
      <button className={hasPoopBag ? "bag ready" : "bag"} onClick={() => clickAction("poopBag")}>
        똥봉투
      </button>
      <button className="door" onClick={() => clickAction("toGarden")}>
        현관문 열기
      </button>
      <style jsx>{`
        .poopbag-scene {
          position: absolute;
          z-index: 5;
          inset: 0;
        }

        button {
          position: absolute;
          border: 0;
          border-radius: 18px;
          padding: 16px 20px;
          font: inherit;
          font-weight: 1000;
          cursor: pointer;
          box-shadow: 0 18px 42px rgba(0,0,0,0.24);
        }

        .bag {
          right: 12%;
          top: 38%;
          background: #294b38;
          color: #eaffde;
        }

        .ready {
          background: #dff0d4;
          color: #2f7415;
        }

        .door {
          right: 10%;
          bottom: 26%;
          background: #fff7ec;
          color: #31241c;
        }
      `}</style>
    </div>
  );
}

function GardenScene({ clickAction }: { clickAction: (action: string) => void }) {
  return (
    <div className="garden">
      <div className="gate">
        <button onClick={() => clickAction("gate")}>대문 앞으로 가기</button>
      </div>
      <style jsx>{`
        .garden {
          position: absolute;
          z-index: 5;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(30, 64, 43, 0.26)),
            repeating-linear-gradient(90deg, rgba(76, 45, 28, 0.34) 0 8px, rgba(48, 28, 18, 0.34) 8px 13px);
          background-size: auto, 100% 55%;
          background-position: center, bottom;
          background-repeat: no-repeat;
        }

        .gate {
          position: absolute;
          left: 50%;
          bottom: 18%;
          width: min(420px, 68vw);
          height: 270px;
          border-radius: 22px 22px 8px 8px;
          border: 8px solid rgba(72, 42, 25, 0.8);
          background: rgba(130, 74, 41, 0.62);
          box-shadow: 0 30px 60px rgba(0,0,0,0.32);
          transform: translateX(-50%);
        }

        button {
          position: absolute;
          left: 50%;
          bottom: 22px;
          border: 0;
          border-radius: 999px;
          padding: 13px 18px;
          background: #fff8ef;
          color: #31241c;
          font: inherit;
          font-weight: 1000;
          transform: translateX(-50%);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

function GateCalm({
  rubyCalmed,
  gamjaQuieted,
  clickAction,
}: {
  rubyCalmed: boolean;
  gamjaQuieted: boolean;
  clickAction: (action: string) => void;
}) {
  return (
    <div className="gate-calm">
      <div className={rubyCalmed ? "dog calm" : "dog spin"}>루비 {rubyCalmed ? "앉음" : "빙글빙글"}</div>
      <div className={gamjaQuieted ? "dog calm" : "dog bark"}>감자 {gamjaQuieted ? "조용" : "멍멍!"}</div>
      <button onClick={() => clickAction("openGate")}>대문 열기</button>
      <style jsx>{`
        .gate-calm {
          position: absolute;
          z-index: 5;
          inset: 0;
        }

        .dog {
          position: absolute;
          width: 150px;
          height: 150px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(255, 248, 239, 0.92);
          color: #30241c;
          font-weight: 1000;
          box-shadow: 0 20px 45px rgba(0,0,0,0.25);
        }

        .spin {
          left: 28%;
          bottom: 28%;
          animation: spin 1s linear infinite;
        }

        .bark {
          right: 28%;
          bottom: 28%;
          animation: bark 0.35s ease-in-out infinite alternate;
        }

        .calm {
          background: #e7f5dc;
          color: #2f7015;
        }

        .calm:first-child {
          left: 28%;
          bottom: 28%;
        }

        .calm:nth-child(2) {
          right: 28%;
          bottom: 28%;
        }

        button {
          position: absolute;
          left: 50%;
          bottom: 96px;
          border: 0;
          border-radius: 999px;
          padding: 14px 20px;
          background: #fff8ef;
          color: #31241c;
          font: inherit;
          font-weight: 1000;
          transform: translateX(-50%);
          cursor: pointer;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes bark {
          from { transform: translateY(0) scale(1); }
          to { transform: translateY(-8px) scale(1.04); }
        }
      `}</style>
    </div>
  );
}

function Neighborhood({ peeFlash }: { peeFlash: boolean }) {
  return (
    <div className="neighborhood">
      <div className="road" />
      <div className="leash-lines" />
      <div className="walk-dogs">
        <PhotoCard src={photos.rubyClose} label="루비" className="walk" />
        <PhotoCard src={photos.gamjaFront} label={peeFlash ? "감자 쉬 중" : "감자"} className="walk" />
      </div>
      {peeFlash && <div className="pee-note">감자가 잠깐 멈췄어요</div>}
      <style jsx>{`
        .neighborhood {
          position: absolute;
          z-index: 4;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.2), rgba(0,0,0,0.18)),
            linear-gradient(90deg, rgba(70, 70, 70, 0.64), rgba(30, 30, 30, 0.72));
        }

        .road {
          position: absolute;
          left: -10%;
          right: -10%;
          bottom: -18%;
          height: 54%;
          background:
            repeating-linear-gradient(90deg, transparent 0 110px, rgba(255,255,255,0.22) 110px 122px),
            linear-gradient(#5b5a58, #262626);
          transform: perspective(420px) rotateX(62deg);
          transform-origin: bottom;
        }

        .leash-lines {
          position: absolute;
          left: 50%;
          bottom: 38%;
          width: 34%;
          height: 90px;
          border-top: 4px solid rgba(255, 230, 195, 0.8);
          border-left: 3px solid rgba(255, 230, 195, 0.75);
          transform: skewX(-26deg);
        }

        .walk-dogs {
          position: absolute;
          right: 9%;
          bottom: 16%;
          display: flex;
          gap: 18px;
          align-items: end;
        }

        .pee-note {
          position: absolute;
          right: 22%;
          bottom: 48%;
          padding: 10px 14px;
          border-radius: 999px;
          background: #fff8ef;
          color: #5f442d;
          font-weight: 1000;
        }
      `}</style>
    </div>
  );
}

function RubyPull() {
  return (
    <div className="pull">
      <PhotoCard src={photos.rubyHappy} label="루비 당김!" className="pull-card" />
      <div className="tension" />
      <style jsx>{`
        .pull {
          position: absolute;
          z-index: 5;
          inset: 0;
        }

        .pull :global(.pull-card) {
          position: absolute;
          right: 10%;
          bottom: 16%;
          animation: tug 0.42s ease-in-out infinite alternate;
        }

        .tension {
          position: absolute;
          left: 23%;
          right: 26%;
          bottom: 38%;
          height: 6px;
          border-radius: 999px;
          background: #ffe3b7;
          box-shadow: 0 0 24px rgba(255, 227, 183, 0.6);
          transform: rotate(-8deg);
        }

        @keyframes tug {
          from { transform: translateX(0) rotate(-2deg); }
          to { transform: translateX(28px) rotate(4deg); }
        }
      `}</style>
    </div>
  );
}

function CarWarning() {
  return (
    <div className="car-warning">
      <div className="car">
        <span />
        <b />
      </div>
      <strong>차가 옵니다</strong>
      <style jsx>{`
        .car-warning {
          position: absolute;
          z-index: 5;
          inset: 0;
          background: rgba(126, 29, 24, 0.26);
        }

        strong {
          position: absolute;
          top: 45%;
          left: 50%;
          padding: 14px 20px;
          border-radius: 18px;
          background: #fff8ef;
          color: #9f271e;
          font-size: 2rem;
          font-weight: 1000;
          transform: translate(-50%, -50%);
        }

        .car {
          position: absolute;
          right: 8%;
          bottom: 24%;
          width: 260px;
          height: 105px;
          border-radius: 34px 54px 24px 24px;
          background: linear-gradient(180deg, #e9e9e9, #8d9298);
          box-shadow: 0 24px 60px rgba(0,0,0,0.36);
          animation: carMove 1.5s ease-in-out infinite alternate;
        }

        .car span,
        .car b {
          position: absolute;
          bottom: -18px;
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: #1d1d1d;
        }

        .car span { left: 34px; }
        .car b { right: 34px; }

        @keyframes carMove {
          from { transform: translateX(0); }
          to { transform: translateX(-50px); }
        }
      `}</style>
    </div>
  );
}

function PoopCleanup({ clickAction }: { clickAction: (action: string) => void }) {
  return (
    <div className="poop-cleanup">
      <PhotoCard src={photos.gamjaFront} label="감자" className="poop-dog" />
      <button className="poop" onClick={() => clickAction("cleanPoop")}>똥 치우기</button>
      <style jsx>{`
        .poop-cleanup {
          position: absolute;
          z-index: 5;
          inset: 0;
        }

        .poop-cleanup :global(.poop-dog) {
          position: absolute;
          right: 18%;
          bottom: 17%;
        }

        .poop {
          position: absolute;
          left: 24%;
          bottom: 21%;
          border: 0;
          border-radius: 999px;
          padding: 16px 22px;
          background: #fff8ef;
          color: #4d3424;
          font: inherit;
          font-weight: 1000;
          cursor: pointer;
          box-shadow: 0 20px 45px rgba(0,0,0,0.28);
        }
      `}</style>
    </div>
  );
}

function ResultPanel({ title, body, action, onClick }: { title: string; body: string; action: string; onClick: () => void }) {
  return (
    <div className="result">
      <h2>{title}</h2>
      <p>{body}</p>
      <button onClick={onClick}>{action}</button>
      <style jsx>{`
        .result {
          position: absolute;
          z-index: 8;
          left: 50%;
          top: 50%;
          width: min(520px, calc(100% - 32px));
          padding: 34px;
          border-radius: 28px;
          background: rgba(255, 250, 242, 0.94);
          color: #2f241d;
          text-align: center;
          box-shadow: 0 26px 70px rgba(0,0,0,0.32);
          transform: translate(-50%, -50%);
        }

        h2 {
          margin: 0 0 12px;
          font-size: 2.3rem;
        }

        p {
          margin: 0;
          line-height: 1.6;
          color: #6b5749;
          font-weight: 800;
        }

        button {
          margin-top: 22px;
          border: 0;
          border-radius: 999px;
          padding: 14px 20px;
          background: #2f6f2d;
          color: white;
          font: inherit;
          font-weight: 1000;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

function PhotoCard({ src, label, className = "" }: { src: string; label: string; className?: string }) {
  return (
    <figure className={`photo-card ${className}`}>
      <Image src={src} alt={label} fill sizes="260px" />
      <figcaption>{label}</figcaption>
      <style jsx>{`
        .photo-card {
          position: relative;
          width: 230px;
          height: 280px;
          margin: 0;
          overflow: hidden;
          border-radius: 26px;
          border: 1px solid rgba(255, 255, 255, 0.36);
          background: #1d1713;
          box-shadow: 0 24px 54px rgba(0, 0, 0, 0.34);
        }

        .photo-card :global(img) {
          object-fit: cover;
        }

        figcaption {
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 12px;
          padding: 8px 11px;
          border-radius: 999px;
          background: rgba(255, 248, 239, 0.9);
          color: #30241c;
          font-weight: 1000;
          text-align: center;
        }

        .small {
          width: 190px;
          height: 230px;
        }

        .walk {
          width: 170px;
          height: 210px;
        }

        @media (max-width: 760px) {
          .photo-card {
            width: 160px;
            height: 210px;
          }

          .small,
          .walk {
            width: 145px;
            height: 185px;
          }
        }
      `}</style>
    </figure>
  );
}
