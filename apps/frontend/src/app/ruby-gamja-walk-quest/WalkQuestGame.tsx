"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Stage =
  | "intro"
  | "secondFloor"
  | "livingRoom"
  | "leashShelf"
  | "leashMission"
  | "poopBag"
  | "garden"
  | "neighborhood"
  | "rubyPull"
  | "carStop"
  | "clear"
  | "fail";

type DogPose = "sleep" | "run" | "sit" | "walk" | "pee" | "wait";
type CarStep = "stop" | "sit";

const callWords = ["루비", "감자", "산책", "나가자"];

const stageCopy: Record<Stage, { mission: string; scene: string }> = {
  intro: {
    mission: "Start 버튼을 눌러 루비와 감자의 산책을 시작하세요.",
    scene: "현관 옆 가족 앨범",
  },
  secondFloor: {
    mission: "2층에서 계단을 내려가세요.",
    scene: "우리집 2층",
  },
  livingRoom: {
    mission: "산책을 가기 위해 강아지를 불러보세요.",
    scene: "거실 / 1층",
  },
  leashShelf: {
    mission: "목줄 2개를 꺼내고, 강아지들에게 먼저 '앉아'라고 말하세요.",
    scene: "현관 선반",
  },
  leashMission: {
    mission: "10초 안에 루비와 감자에게 목줄을 조심히 채우세요.",
    scene: "목줄 채우기",
  },
  poopBag: {
    mission: "나가기 전 문 옆 똥봉투를 챙기세요.",
    scene: "현관문 앞",
  },
  garden: {
    mission: "정원을 지나 대문을 열고 동네로 나가세요.",
    scene: "우리집 정원",
  },
  neighborhood: {
    mission: "루비와 감자와 함께 동네 한 바퀴를 완료하세요.",
    scene: "동네 산책길",
  },
  rubyPull: {
    mission: "루비가 당겨요! 5초 안에 '천천히'를 입력하세요.",
    scene: "대문 밖",
  },
  carStop: {
    mission: "차가 와요! 먼저 '멈춰', 그 다음 '앉아'를 입력하세요.",
    scene: "횡단 골목",
  },
  clear: {
    mission: "산책 완료! 루비와 감자가 행복해 보여요.",
    scene: "집으로 돌아오는 길",
  },
  fail: {
    mission: "산책 실패... 다시 도전해볼까요?",
    scene: "다시 도전",
  },
};

export default function WalkQuestGame() {
  const [stage, setStage] = useState<Stage>("intro");
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("루비와 감자가 산책을 기다리고 있어요.");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [falls, setFalls] = useState(0);
  const [hasLeashes, setHasLeashes] = useState(false);
  const [dogsSitting, setDogsSitting] = useState(false);
  const [rubyLeashed, setRubyLeashed] = useState(false);
  const [gamjaLeashed, setGamjaLeashed] = useState(false);
  const [hasPoopBag, setHasPoopBag] = useState(false);
  const [danger, setDanger] = useState(0);
  const [walkProgress, setWalkProgress] = useState(0);
  const [carStep, setCarStep] = useState<CarStep>("stop");
  const [peeFlash, setPeeFlash] = useState(false);
  const [safeStreak, setSafeStreak] = useState(0);

  const dogPose = useMemo<DogPose>(() => {
    if (stage === "livingRoom" && callWords.includes(input.trim())) return "run";
    if (stage === "leashShelf" || stage === "leashMission") return dogsSitting ? "sit" : "run";
    if (peeFlash) return "pee";
    if (stage === "carStop") return "wait";
    if (stage === "neighborhood" || stage === "rubyPull" || stage === "garden") return "walk";
    return stage === "livingRoom" ? "sleep" : "wait";
  }, [dogsSitting, input, peeFlash, stage]);

  useEffect(() => {
    if (stage !== "leashMission" && stage !== "rubyPull" && stage !== "carStop") return;
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      if (stage === "rubyPull") {
        handleFall("루비가 확 당겨서 넘어졌어요!");
      } else if (stage === "carStop") {
        addDanger("시간 안에 안전 명령을 못 했어요.");
      } else {
        fail("10초 안에 목줄을 채우지 못했어요.");
      }
      return;
    }
    const timer = window.setTimeout(() => setTimeLeft((current) => (current === null ? null : current - 1)), 1000);
    return () => window.clearTimeout(timer);
  // Timer effects intentionally depend on the active phase and clock only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, timeLeft]);

  useEffect(() => {
    if (stage !== "neighborhood") return;
    const progressTimer = window.setInterval(() => {
      setWalkProgress((current) => {
        const next = Math.min(100, current + 5);
        if (next >= 100) {
          window.clearInterval(progressTimer);
          setStage("clear");
          setMessage("산책 완료! 루비와 감자가 행복해 보여요.");
        }
        return next;
      });
    }, 1400);
    const rubyTimer = window.setTimeout(() => {
      setStage("rubyPull");
      setTimeLeft(5);
      setMessage("루비가 갑자기 앞으로 튀어나가려고 해요!");
    }, 4500);
    const carTimer = window.setTimeout(() => {
      setStage("carStop");
      setCarStep("stop");
      setTimeLeft(7);
      setMessage("자동차가 골목으로 들어왔어요. 먼저 '멈춰'!");
    }, 9800);
    const peeTimer = window.setInterval(() => {
      setPeeFlash(true);
      setMessage("감자가 잠깐 멈춰서 오줌을 싸요. 기다려 주세요.");
      window.setTimeout(() => {
        setPeeFlash(false);
        if (stage === "neighborhood") setMessage("다시 산책을 이어갑니다.");
      }, 2600);
    }, 30000);
    return () => {
      window.clearInterval(progressTimer);
      window.clearTimeout(rubyTimer);
      window.clearTimeout(carTimer);
      window.clearInterval(peeTimer);
    };
  }, [stage]);

  function startGame() {
    resetState();
    setStage("secondFloor");
    setMessage("2층입니다. 아래에서 루비와 감자가 조용히 자고 있어요.");
  }

  function resetState() {
    setInput("");
    setTimeLeft(null);
    setFalls(0);
    setHasLeashes(false);
    setDogsSitting(false);
    setRubyLeashed(false);
    setGamjaLeashed(false);
    setHasPoopBag(false);
    setDanger(0);
    setWalkProgress(0);
    setCarStep("stop");
    setPeeFlash(false);
    setSafeStreak(0);
  }

  function fail(reason: string) {
    setStage("fail");
    setTimeLeft(null);
    setMessage(reason);
  }

  function handleFall(reason: string) {
    const nextFalls = falls + 1;
    setFalls(nextFalls);
    setTimeLeft(null);
    if (nextFalls >= 3) {
      fail(`${reason} 세 번 넘어져서 산책을 계속할 수 없어요.`);
      return;
    }
    setStage("neighborhood");
    setMessage(`${reason} 넘어짐 ${nextFalls}/3. 다시 천천히 걸어봅니다.`);
  }

  function addDanger(reason: string) {
    const nextDanger = Math.min(100, danger + 34);
    setDanger(nextDanger);
    setTimeLeft(null);
    if (nextDanger >= 100) {
      fail(`${reason} 위험 게이지가 가득 찼어요.`);
      return;
    }
    setStage("neighborhood");
    setMessage(`${reason} 위험 게이지가 올라갔어요. 더 조심해야 해요.`);
  }

  function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const command = input.trim();
    if (!command) return;

    if (stage === "livingRoom") {
      if (callWords.includes(command)) {
        setMessage("루비와 감자가 달려와 꼬리를 흔들고 점프해요!");
        window.setTimeout(() => {
          setStage("leashShelf");
          setMessage("선반에 목줄 2개가 있어요. 먼저 꺼내세요.");
        }, 900);
      } else {
        setMessage("강아지들이 아직 반응하지 않아요.");
      }
    } else if (stage === "leashShelf") {
      if (command === "앉아") {
        setDogsSitting(true);
        setMessage("루비와 감자가 얌전히 앉았어요. 이제 목줄을 채울 수 있어요.");
      } else {
        setMessage("지금은 '앉아'라고 말해야 목줄을 안전하게 채울 수 있어요.");
      }
    } else if (stage === "rubyPull") {
      if (command === "천천히") {
        setStage("neighborhood");
        setTimeLeft(null);
        setSafeStreak((current) => current + 1);
        setMessage("루비가 속도를 줄였어요. 목줄이 다시 느슨해졌습니다.");
      } else {
        handleFall("루비가 말을 못 알아듣고 당겼어요!");
      }
    } else if (stage === "carStop") {
      if (carStep === "stop" && command === "멈춰") {
        setCarStep("sit");
        setTimeLeft(5);
        setMessage("멈췄어요. 이제 '앉아'를 입력해서 기다리게 하세요.");
      } else if (carStep === "sit" && command === "앉아") {
        setStage("neighborhood");
        setTimeLeft(null);
        setSafeStreak((current) => current + 1);
        setMessage("루비와 감자가 안전하게 앉아서 차를 보냈어요.");
      } else {
        addDanger("명령 순서가 꼬였어요.");
      }
    } else {
      setMessage("지금은 클릭으로 행동해야 해요.");
    }

    setInput("");
  }

  function clickPrimary(action: string) {
    if (stage === "secondFloor" && action === "stairs") {
      setStage("livingRoom");
      setMessage("거실에 루비와 감자가 자고 있어요. 이름을 불러보세요.");
    }
    if (stage === "leashShelf" && action === "leashes") {
      setHasLeashes(true);
      setMessage("목줄 2개를 챙겼어요. 채우기 전에는 반드시 '앉아'!");
    }
    if (stage === "leashShelf" && action === "start-leash") {
      if (!hasLeashes) {
        setMessage("먼저 선반에서 목줄 2개를 꺼내야 해요.");
        return;
      }
      if (!dogsSitting) {
        setMessage("먼저 강아지들을 앉혀야 해요!");
        return;
      }
      setStage("leashMission");
      setTimeLeft(10);
      setMessage("털이 끼지 않게 조심해서 채워주세요!");
    }
    if (stage === "poopBag" && action === "bag") {
      setHasPoopBag(true);
      setMessage("똥봉투를 챙겼어요. 이제 문을 열고 나갈 수 있어요.");
    }
    if (stage === "poopBag" && action === "door") {
      if (!hasPoopBag) {
        setMessage("뭐 잊은 게 있지 않나?");
        return;
      }
      setStage("garden");
      setMessage("정원에 나왔어요. 대문을 열면 본격 산책 시작입니다.");
    }
    if (stage === "garden" && action === "gate") {
      setStage("neighborhood");
      setMessage("동네 산책을 시작합니다. 루비가 벌써 신났어요.");
    }
  }

  function leashDog(dog: "ruby" | "gamja", zone: "safe" | "bad") {
    if (stage !== "leashMission") return;
    if (zone !== "safe") {
      setMessage("털이 낄 뻔했어요! 다시 조심히 채워주세요.");
      return;
    }
    if (dog === "ruby") setRubyLeashed(true);
    if (dog === "gamja") setGamjaLeashed(true);
    setMessage(`${dog === "ruby" ? "루비" : "감자"} 목줄을 조심히 채웠어요.`);
    const rubyDone = dog === "ruby" ? true : rubyLeashed;
    const gamjaDone = dog === "gamja" ? true : gamjaLeashed;
    if (rubyDone && gamjaDone) {
      setStage("poopBag");
      setTimeLeft(null);
      setMessage("목줄 준비 완료! 이제 똥봉투를 챙겨야 해요.");
    }
  }

  const commandPlaceholder =
    stage === "livingRoom"
      ? "루비 / 감자 / 산책 / 나가자"
      : stage === "leashShelf"
        ? "앉아"
        : stage === "rubyPull"
          ? "천천히"
          : stage === "carStop"
            ? carStep === "stop"
              ? "멈춰"
              : "앉아"
            : "현재 단계에서는 클릭 행동을 사용하세요";

  return (
    <main className="min-h-screen bg-[#efe2d2] text-[#241811]">
      <header className="border-b border-[#dcc6ae] bg-[#fffaf1]/90 backdrop-blur">
        <nav className="mx-auto flex min-h-16 w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4 max-md:flex-col max-md:items-start max-md:py-4">
          <Link className="text-sm font-black text-[#6e4a2e]" href="/">
            Wax-Cracking Home
          </Link>
          <strong className="text-sm font-black text-[#2f7b42]">루비 감자와 산책</strong>
        </nav>
      </header>

      <section className="mx-auto grid w-[min(1180px,calc(100%-32px))] grid-cols-[minmax(0,1fr)_330px] gap-5 py-6 max-lg:grid-cols-1">
        <div className="overflow-hidden rounded-lg border border-[#d6bfa7] bg-[#fff8ed] shadow-[0_22px_55px_rgba(82,54,32,0.18)]">
          <div className="flex items-center justify-between border-b border-[#e6d2bd] bg-white/70 px-5 py-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2f7b42]">First-Person Walk Mission</p>
              <h1 className="text-3xl font-black">루비 감자와 산책</h1>
            </div>
            <span className="rounded-full bg-[#2f7b42] px-4 py-2 text-sm font-black text-white">
              {stageCopy[stage].scene}
            </span>
          </div>

          <GameView
            clickPrimary={clickPrimary}
            dogPose={dogPose}
            leashDog={leashDog}
            stage={stage}
            startGame={startGame}
          />

          <div className="border-t border-[#e6d2bd] bg-[#fffaf4] p-5">
            <p className="text-lg font-black text-[#2f241a]">{stageCopy[stage].mission}</p>
            <p className="mt-2 min-h-7 text-sm font-extrabold text-[#7d624f]">{message}</p>
            {stage !== "intro" && stage !== "clear" && stage !== "fail" ? (
              <form className="mt-4 flex gap-2 max-sm:flex-col" onSubmit={submitCommand}>
                <input
                  className="min-h-12 flex-1 rounded-lg border border-[#d8c2aa] bg-white px-4 text-base font-bold outline-none focus:border-[#2f7b42]"
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={commandPlaceholder}
                  value={input}
                />
                <button className="min-h-12 rounded-lg bg-[#241811] px-5 text-sm font-black text-white" type="submit">
                  확인
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <aside className="grid gap-4">
          <StatusPanel
            danger={danger}
            falls={falls}
            gamjaLeashed={gamjaLeashed}
            hasPoopBag={hasPoopBag}
            rubyLeashed={rubyLeashed}
            safeStreak={safeStreak}
            timeLeft={timeLeft}
            walkProgress={walkProgress}
          />
          <div className="rounded-lg border border-[#d6bfa7] bg-[#fffaf4] p-4">
            <h2 className="text-lg font-black">조작</h2>
            <ul className="mt-3 grid gap-2 text-sm font-bold leading-6 text-[#745d4a]">
              <li>텍스트 입력: 강아지 부르기, 앉아, 천천히, 멈춰</li>
              <li>클릭: 계단, 목줄, 강아지, 똥봉투, 문, 대문</li>
              <li>실패 조건: 목줄 제한시간, 넘어짐 3회, 위험 게이지 100%</li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}

function GameView({
  clickPrimary,
  dogPose,
  leashDog,
  stage,
  startGame,
}: {
  clickPrimary: (action: string) => void;
  dogPose: DogPose;
  leashDog: (dog: "ruby" | "gamja", zone: "safe" | "bad") => void;
  stage: Stage;
  startGame: () => void;
}) {
  if (stage === "intro") {
    return (
      <div className="relative min-h-[560px] overflow-hidden bg-[#dcb98f] p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.45),transparent_32%),linear-gradient(180deg,#f4d4a8,#9ed08f)]" />
        <div className="relative mx-auto grid h-full max-w-4xl place-items-center">
          <div className="w-full rounded-lg border border-white/60 bg-white/75 p-6 text-center shadow-[0_24px_60px_rgba(83,55,33,0.22)] backdrop-blur">
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <DogPhoto name="루비" tone="brown" />
              <DogPhoto name="감자" tone="gold" />
            </div>
            <h2 className="mt-6 text-5xl font-black max-sm:text-4xl">루비 감자와 산책</h2>
            <p className="mt-3 text-base font-extrabold text-[#765c47]">
              제한시간과 돌발 이벤트를 넘기며 두 강아지와 무사히 동네 한 바퀴를 돌아오세요.
            </p>
            <button
              className="mt-6 min-h-14 rounded-lg bg-[#2f7b42] px-8 text-lg font-black text-white shadow-[0_12px_24px_rgba(47,123,66,0.28)]"
              onClick={startGame}
              type="button"
            >
              Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "clear" || stage === "fail") {
    return (
      <div className={`grid min-h-[560px] place-items-center p-6 text-center ${stage === "clear" ? "bg-[#bfe8c2]" : "bg-[#f2c1b6]"}`}>
        <div className="rounded-lg bg-white/78 p-8 shadow-[0_20px_50px_rgba(82,54,32,0.18)]">
          <div className="mx-auto flex justify-center gap-4">
            <MiniDog tone="brown" pose="walk" />
            <MiniDog tone="gold" pose="walk" />
          </div>
          <h2 className="mt-5 text-4xl font-black">
            {stage === "clear" ? "산책 완료!" : "산책 실패..."}
          </h2>
          <p className="mt-3 text-lg font-extrabold text-[#6d5140]">
            {stage === "clear" ? "산책 완료! 루비와 감자가 행복해 보여요." : "산책 실패... 다시 도전해볼까요?"}
          </p>
          <button className="mt-6 min-h-12 rounded-lg bg-[#241811] px-6 font-black text-white" onClick={() => window.location.reload()} type="button">
            Restart
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative min-h-[560px] overflow-hidden ${sceneClass(stage)}`}>
      <div className="absolute inset-x-0 bottom-0 h-[44%] bg-[linear-gradient(180deg,transparent,#7bbf74)]" />
      <FirstPersonHands stage={stage} />
      {stage === "secondFloor" ? (
        <button className="absolute left-[36%] top-[30%] h-64 w-48 rounded-lg border-4 border-[#b58b62] bg-[#d7aa78] text-lg font-black text-[#4b3323] shadow-xl" onClick={() => clickPrimary("stairs")} type="button">
          계단 내려가기
        </button>
      ) : null}
      {stage === "leashShelf" ? (
        <button className="absolute right-12 top-16 rounded-lg border border-[#b78f69] bg-[#fff4df] p-5 font-black shadow-xl" onClick={() => clickPrimary("leashes")} type="button">
          목줄 2개 꺼내기
        </button>
      ) : null}
      {stage === "leashShelf" ? (
        <button className="absolute right-12 top-40 rounded-lg bg-[#2f7b42] px-5 py-4 font-black text-white shadow-xl" onClick={() => clickPrimary("start-leash")} type="button">
          목줄 채우기 시작
        </button>
      ) : null}
      {stage === "poopBag" ? (
        <>
          <button className="absolute right-16 top-28 rounded-lg bg-[#73b85e] px-5 py-4 font-black text-white shadow-xl" onClick={() => clickPrimary("bag")} type="button">
            똥봉투 챙기기
          </button>
          <button className="absolute left-[44%] top-20 h-64 w-36 rounded-t-full bg-[#8b5a38] font-black text-white shadow-2xl" onClick={() => clickPrimary("door")} type="button">
            문 열기
          </button>
        </>
      ) : null}
      {stage === "garden" ? (
        <button className="absolute left-[40%] top-24 h-56 w-48 rounded-lg border-4 border-[#7b5538] bg-[#c8955f] font-black text-white shadow-2xl" onClick={() => clickPrimary("gate")} type="button">
          대문 열기
        </button>
      ) : null}
      {stage === "carStop" ? (
        <div className="absolute left-1/2 top-16 -translate-x-1/2 rounded-lg bg-red-600 px-6 py-4 text-2xl font-black text-white shadow-2xl animate-pulse">
          위험! 자동차 접근
        </div>
      ) : null}
      {stage === "leashMission" ? (
        <LeashTargets leashDog={leashDog} />
      ) : null}
      <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 items-end gap-14">
        <MiniDog pose={dogPose} tone="brown" />
        <MiniDog pose={dogPose} tone="gold" />
      </div>
    </div>
  );
}

function DogPhoto({ name, tone }: { name: string; tone: "brown" | "gold" }) {
  return (
    <div className="rounded-lg bg-[#fff8ee] p-4 shadow-inner">
      <div className="mx-auto grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-[linear-gradient(180deg,#c9e7ff,#f9e1b7)]">
        <MiniDog pose="wait" tone={tone} />
      </div>
      <p className="mt-3 text-xl font-black">{name}</p>
    </div>
  );
}

function MiniDog({ pose, tone }: { pose: DogPose; tone: "brown" | "gold" }) {
  const color = tone === "brown" ? "#7b4b32" : "#f0bd5e";
  const ear = tone === "brown" ? "#4e2c1d" : "#a76a2b";
  return (
    <div className={`relative h-28 w-28 ${pose === "run" ? "animate-bounce" : ""}`}>
      <div className="absolute bottom-0 left-3 h-16 w-22 rounded-[48%] shadow-[inset_-8px_-8px_0_rgba(0,0,0,0.12)]" style={{ backgroundColor: color }} />
      <div className="absolute bottom-12 left-8 h-16 w-16 rounded-full shadow-[inset_-6px_-8px_0_rgba(0,0,0,0.1)]" style={{ backgroundColor: color }} />
      <div className="absolute bottom-[88px] left-8 h-9 w-6 -rotate-12 rounded-full" style={{ backgroundColor: ear }} />
      <div className="absolute bottom-[88px] right-7 h-9 w-6 rotate-12 rounded-full" style={{ backgroundColor: ear }} />
      <div className="absolute bottom-[73px] left-12 h-2 w-2 rounded-full bg-[#1f1712] shadow-[22px_0_0_#1f1712]" />
      <div className="absolute bottom-[62px] left-[52px] h-2 w-5 rounded-full bg-[#5b321f]" />
      <div className={`absolute bottom-4 -right-3 h-4 w-11 origin-left rounded-full ${pose === "run" || pose === "walk" ? "animate-pulse" : ""}`} style={{ backgroundColor: color, transform: "rotate(-24deg)" }} />
      {pose === "pee" ? <div className="absolute -bottom-2 right-4 h-8 w-6 rounded-full bg-[#f4d35e]/70 blur-sm" /> : null}
      {pose === "sit" || pose === "wait" ? <div className="absolute bottom-1 left-8 h-5 w-16 rounded-full bg-black/10 blur-md" /> : null}
    </div>
  );
}

function FirstPersonHands({ stage }: { stage: Stage }) {
  const showLeash = stage === "garden" || stage === "neighborhood" || stage === "rubyPull" || stage === "carStop";
  return (
    <>
      <div className="absolute bottom-0 left-[16%] h-28 w-24 rounded-t-full bg-[#f2c7a4] shadow-[inset_-8px_-6px_0_rgba(0,0,0,0.08)]" />
      <div className="absolute bottom-0 right-[16%] h-28 w-24 rounded-t-full bg-[#f2c7a4] shadow-[inset_8px_-6px_0_rgba(0,0,0,0.08)]" />
      {showLeash ? (
        <>
          <div className="absolute bottom-24 left-[23%] h-1 w-[28%] origin-left -rotate-12 bg-[#3b2b22]" />
          <div className="absolute bottom-24 right-[23%] h-1 w-[28%] origin-right rotate-12 bg-[#3b2b22]" />
        </>
      ) : null}
    </>
  );
}

function LeashTargets({ leashDog }: { leashDog: (dog: "ruby" | "gamja", zone: "safe" | "bad") => void }) {
  return (
    <div className="absolute inset-x-0 bottom-52 flex justify-center gap-20">
      <button className="rounded-full bg-[#2f7b42] px-5 py-4 font-black text-white shadow-xl" onClick={() => leashDog("ruby", "safe")} type="button">
        루비 목 위치 클릭
      </button>
      <button className="rounded-full bg-[#2f7b42] px-5 py-4 font-black text-white shadow-xl" onClick={() => leashDog("gamja", "safe")} type="button">
        감자 목 위치 클릭
      </button>
      <button className="absolute -bottom-14 rounded-full bg-[#d6533d] px-4 py-3 text-sm font-black text-white" onClick={() => leashDog("ruby", "bad")} type="button">
        급하게 클릭
      </button>
    </div>
  );
}

function StatusPanel({
  danger,
  falls,
  gamjaLeashed,
  hasPoopBag,
  rubyLeashed,
  safeStreak,
  timeLeft,
  walkProgress,
}: {
  danger: number;
  falls: number;
  gamjaLeashed: boolean;
  hasPoopBag: boolean;
  rubyLeashed: boolean;
  safeStreak: number;
  timeLeft: number | null;
  walkProgress: number;
}) {
  const rows = [
    ["제한시간", timeLeft === null ? "-" : `${timeLeft}초`],
    ["넘어짐", `${falls}/3`],
    ["똥봉투", hasPoopBag ? "챙김" : "없음"],
    ["루비 목줄", rubyLeashed ? "착용" : "미착용"],
    ["감자 목줄", gamjaLeashed ? "착용" : "미착용"],
    ["안전 성공", `${safeStreak}회`],
  ];

  return (
    <div className="rounded-lg border border-[#d6bfa7] bg-[#fffaf4] p-4">
      <h2 className="text-xl font-black">산책 상태</h2>
      <div className="mt-4 grid gap-2">
        {rows.map(([label, value]) => (
          <div className="flex justify-between rounded-lg bg-white px-3 py-2 text-sm font-extrabold" key={label}>
            <span className="text-[#7d624f]">{label}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>
      <Meter label="위험 게이지" tone="danger" value={danger} />
      <Meter label="동네 한 바퀴" tone="walk" value={walkProgress} />
    </div>
  );
}

function Meter({ label, tone, value }: { label: string; tone: "danger" | "walk"; value: number }) {
  return (
    <div className="mt-4">
      <div className="flex justify-between text-xs font-black text-[#7d624f]">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#ead9c7]">
        <div className={`h-full rounded-full ${tone === "danger" ? "bg-[#d6533d]" : "bg-[#2f7b42]"}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function sceneClass(stage: Stage) {
  if (stage === "secondFloor") return "bg-[linear-gradient(180deg,#efe4d7,#c9a27b)]";
  if (stage === "livingRoom" || stage === "leashShelf" || stage === "leashMission" || stage === "poopBag") {
    return "bg-[linear-gradient(180deg,#f6eadb,#d7b692)]";
  }
  if (stage === "garden") return "bg-[linear-gradient(180deg,#bfe4ff,#8fcf83)]";
  return "bg-[linear-gradient(180deg,#a9d7ff,#93c782)]";
}
