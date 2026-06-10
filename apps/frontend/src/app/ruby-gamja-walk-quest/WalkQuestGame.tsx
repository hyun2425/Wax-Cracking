"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Phase =
  | "intro"
  | "upstairs"
  | "living"
  | "excited"
  | "leashPrep"
  | "leashMission"
  | "leashZoom"
  | "poopBag"
  | "garden"
  | "gate"
  | "walk"
  | "pull"
  | "poop"
  | "run"
  | "car"
  | "barkingDog"
  | "boss"
  | "home"
  | "clear"
  | "fail";

type Dog = "ruby" | "gamja";
type PoopTool = "bag" | "leaf" | "sock" | null;

// Replace only these paths when swapping Ruby/Gamja cutout assets later.
const dog = {
  ruby: {
    call: "/ruby-gamja/cutouts-v2/ruby-call.png",
    hop: "/ruby-gamja/cutouts-v2/ruby-hop.png",
    stairs: "/ruby-gamja/cutouts-v2/ruby-stairs.png",
    sleep: "/ruby-gamja/cutouts-v2/ruby-sleep.png",
    sit: "/ruby-gamja/cutouts-v2/ruby-sit.png",
    walk: "/ruby-gamja/cutouts-v2/ruby-walk.png",
    alert: "/ruby-gamja/cutouts-v2/ruby-alert.png",
    run: "/ruby-gamja/cutouts-v2/ruby-run.png",
    heart: "/ruby-gamja/cutouts-v2/ruby-heart.png",
  },
  gamja: {
    call: "/ruby-gamja/cutouts-v3/gamja-call.png",
    hop: "/ruby-gamja/cutouts-v3/gamja-hop.png",
    stairs: "/ruby-gamja/cutouts-v3/gamja-stairs.png",
    sleep: "/ruby-gamja/cutouts-v3/gamja-sleep.png",
    sit: "/ruby-gamja/cutouts-v3/gamja-sit.png",
    walk: "/ruby-gamja/cutouts-v3/gamja-walk.png",
    alert: "/ruby-gamja/cutouts-v3/gamja-alert.png",
    run: "/ruby-gamja/cutouts-v3/gamja-run.png",
    pee: "/ruby-gamja/cutouts-v3/gamja-pee.png",
    poop: "/ruby-gamja/cutouts-v3/gamja-poop.png",
    heart: "/ruby-gamja/cutouts-v3/gamja-heart.png",
  },
  duo: "/ruby-gamja/cutouts-v2/duo-heart.png",
};

type SoundName = "bark" | "happy" | "leash" | "success" | "fall" | "car" | "poop" | "step";

function playSound(name: SoundName) {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const ctx = new AudioContextClass();
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(name === "car" ? 0.18 : 0.08, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

  const playTone = (frequency: number, start: number, duration: number, type: OscillatorType = "sine") => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now + start);
    osc.connect(gain);
    osc.start(now + start);
    osc.stop(now + start + duration);
  };

  if (name === "bark") {
    playTone(240, 0, 0.12, "square");
    playTone(190, 0.14, 0.14, "square");
  } else if (name === "car") {
    playTone(360, 0, 0.18, "sawtooth");
    playTone(300, 0.22, 0.2, "sawtooth");
  } else if (name === "fall") {
    playTone(120, 0, 0.34, "sawtooth");
  } else if (name === "leash") {
    playTone(680, 0, 0.07, "triangle");
    playTone(460, 0.08, 0.08, "triangle");
  } else if (name === "poop") {
    playTone(180, 0, 0.08, "triangle");
    playTone(140, 0.1, 0.08, "triangle");
  } else if (name === "step") {
    playTone(150, 0, 0.05, "sine");
  } else {
    playTone(520, 0, 0.08, "triangle");
    playTone(760, 0.09, 0.1, "triangle");
  }

  window.setTimeout(() => void ctx.close(), 520);
}

const callWords = ["루비", "감자"];
const walkWords = ["산책가자", "나가자", "나갈까"];

const phaseInfo: Record<Phase, { scene: string; mission: string; bg: string }> = {
  intro: { scene: "우리집", mission: "Start 버튼을 눌러 산책을 시작하세요.", bg: "home" },
  upstairs: { scene: "2층 계단", mission: "계단을 내려가 1층으로 이동하세요.", bg: "stairs" },
  living: { scene: "1층 거실", mission: "루비 또는 감자를 부르고, 산책 말을 해보세요.", bg: "living" },
  excited: { scene: "거실", mission: "강아지들이 신났어요. 이제 목줄을 준비하세요.", bg: "living" },
  leashPrep: { scene: "현관", mission: "먼저 앉아를 입력/클릭한 뒤 목줄 미션을 시작하세요.", bg: "entry" },
  leashMission: { scene: "현관", mission: "10초 안에 루비와 감자 목을 클릭하고 목줄을 드래그하세요.", bg: "entry" },
  leashZoom: { scene: "목줄 확대", mission: "목줄을 목 고리까지 드래그해서 채우세요.", bg: "entry" },
  poopBag: { scene: "현관문", mission: "똥봉투를 챙기세요. 안 챙겨도 두 번 누르면 나갈 수 있어요.", bg: "entry" },
  garden: { scene: "정원", mission: "정원을 지나 대문 앞으로 가세요.", bg: "garden" },
  gate: { scene: "대문 앞", mission: "루비는 앉아, 감자는 조용히 해. 진정 후 대문을 여세요.", bg: "gate" },
  walk: { scene: "늘 가던 산책길", mission: "루비와 감자를 따라 안전하게 걸으세요.", bg: "street" },
  pull: { scene: "산책길", mission: "루비가 당겨요. 5초 안에 천천히를 클릭하세요.", bg: "street" },
  poop: { scene: "산책길", mission: "감자 똥을 처리하세요.", bg: "street" },
  run: { scene: "산책길", mission: "스페이스바를 빠르게 눌러 속도를 따라가세요.", bg: "street" },
  car: { scene: "차 오는 골목", mission: "멈춰 → 길 옆으로 드래그 → 기다려 순서로 처리하세요.", bg: "road" },
  barkingDog: { scene: "담장 옆", mission: "다른 집 강아지가 짖어요. 5초 안에 무시해를 클릭하세요.", bg: "fence" },
  boss: { scene: "마지막 보스", mission: "풀려 있는 강아지가 달려와요. 5초 안에 블로킹!", bg: "fence" },
  home: { scene: "집 앞", mission: "집에 도착했어요. 마지막으로 문을 열고 들어가세요.", bg: "gate" },
  clear: { scene: "산책 완료", mission: "산책 완료! 루비와 감자가 행복해 보여요.", bg: "home" },
  fail: { scene: "산책 실패", mission: "산책 실패... 다시 도전해볼까요?", bg: "home" },
};

export default function WalkQuestGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [message, setMessage] = useState("루비와 감자가 산책을 기다리고 있어요.");
  const [input, setInput] = useState("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [falls, setFalls] = useState(0);
  const [calledDogs, setCalledDogs] = useState(false);
  const [dogsSitting, setDogsSitting] = useState(false);
  const [rubyLeashed, setRubyLeashed] = useState(false);
  const [gamjaLeashed, setGamjaLeashed] = useState(false);
  const [zoomDog, setZoomDog] = useState<Dog | null>(null);
  const [hasPoopBag, setHasPoopBag] = useState(false);
  const [poopBagWarning, setPoopBagWarning] = useState(false);
  const [rubyCalm, setRubyCalm] = useState(false);
  const [gamjaQuiet, setGamjaQuiet] = useState(false);
  const [walkStep, setWalkStep] = useState(0);
  const [peePulse, setPeePulse] = useState(false);
  const [poopTool, setPoopTool] = useState<PoopTool>(null);
  const [runTaps, setRunTaps] = useState(0);
  const [carStopped, setCarStopped] = useState(false);
  const [dogsRoadside, setDogsRoadside] = useState(false);
  const [hearts, setHearts] = useState(false);

  const info = phaseInfo[phase];
  const needsInput = ["living", "leashPrep"].includes(phase);

  function showHearts(text: string) {
    setMessage(text);
    setHearts(true);
    playSound("success");
    window.setTimeout(() => setHearts(false), 1300);
  }

  function reset() {
    setPhase("intro");
    setMessage("루비와 감자가 산책을 기다리고 있어요.");
    setInput("");
    setTimeLeft(null);
    setFalls(0);
    setCalledDogs(false);
    setDogsSitting(false);
    setRubyLeashed(false);
    setGamjaLeashed(false);
    setZoomDog(null);
    setHasPoopBag(false);
    setPoopBagWarning(false);
    setRubyCalm(false);
    setGamjaQuiet(false);
    setWalkStep(0);
    setPeePulse(false);
    setPoopTool(null);
    setRunTaps(0);
    setCarStopped(false);
    setDogsRoadside(false);
    setHearts(false);
  }

  function start() {
    playSound("happy");
    reset();
    setPhase("upstairs");
    setMessage("2층입니다. 아래층에서 조용한 강아지 기척이 느껴져요.");
  }

  function fall(reason: string) {
    playSound("fall");
    const next = falls + 1;
    setFalls(next);
    setTimeLeft(null);
    if (next >= 3) {
      setPhase("fail");
      setMessage(`${reason} 3번 넘어져서 오늘 산책은 실패예요.`);
      return;
    }
    setPhase("walk");
    setMessage(`${reason} 넘어짐 ${next}/3. 다시 침착하게 걸어요.`);
  }

  function hardFail(reason: string) {
    playSound("fall");
    setPhase("fail");
    setTimeLeft(null);
    setMessage(reason);
  }

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      const timeout = window.setTimeout(() => {
        if (phase === "leashMission" || phase === "leashZoom") {
          setDogsSitting(false);
          setRubyLeashed(false);
          setGamjaLeashed(false);
          setZoomDog(null);
        setPhase("leashPrep");
        playSound("bark");
        setMessage("10초 안에 못 채웠어요. 루비와 감자가 다시 일어나서 콩콩 뛰어요. 다시 앉아부터!");
        } else if (phase === "pull") {
          fall("루비가 앞으로 확 당겼어요.");
        } else if (phase === "barkingDog") {
          fall("다른 집 강아지에게 반응하다가 줄이 꼬였어요.");
        } else if (phase === "boss") {
          hardFail("블로킹이 늦었어요. 루비/감자가 위험해져서 바로 실패입니다.");
        } else if (phase === "run") {
          fall("속도를 못 따라가서 발이 꼬였어요.");
        }
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    const timer = window.setTimeout(() => setTimeLeft((current) => (current === null ? null : current - 1)), 1000);
    return () => window.clearTimeout(timer);
    // Timeout handlers intentionally use the current phase snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft]);

  useEffect(() => {
    if (phase !== "walk") return;
    const peeTimer = window.setInterval(() => {
      setPeePulse(true);
      setMessage("감자가 멈춰서 오줌으로 영역 표시 중... 루비는 벌써 앞으로 가고 싶어 해요.");
      window.setTimeout(() => setPeePulse(false), 2400);
    }, 15000);

    const eventTimer = window.setTimeout(() => {
      if (walkStep === 0) {
        setPhase("pull");
        setTimeLeft(5);
        setMessage("루비가 신나서 앞으로 당겨요. 천천히!");
      } else if (walkStep === 1) {
        setPhase("poop");
        setPoopTool(hasPoopBag ? "bag" : null);
        setMessage("감자가 똥을 쌌어요. 펫티켓 시간입니다.");
      } else if (walkStep === 2) {
        setPhase("run");
        setRunTaps(0);
        setTimeLeft(8);
        setMessage("날씨가 좋네요. 한번 뛰어볼까요? 스페이스바를 빠르게!");
      } else if (walkStep === 3) {
        setPhase("barkingDog");
        setTimeLeft(5);
        setMessage("담장 안쪽 강아지가 짖어요. 루비와 감자도 반응하려고 해요.");
      } else if (walkStep === 4) {
        setPhase("boss");
        setTimeLeft(5);
        setMessage("풀려 있는 강아지가 달려옵니다. 루감이를 지켜야 해요!");
      } else {
        setPhase("home");
        setMessage("익숙한 집 앞에 도착했어요.");
      }
    }, 3600);

    return () => {
      window.clearInterval(peeTimer);
      window.clearTimeout(eventTimer);
    };
  }, [hasPoopBag, phase, walkStep]);

  useEffect(() => {
    if (phase !== "run") return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      event.preventDefault();
      setRunTaps((current) => {
        const next = current + 1;
        if (next >= 18) {
          setTimeLeft(null);
          setPhase("car");
          setCarStopped(false);
          setDogsRoadside(false);
          showHearts("속도를 따라잡았어요! 그런데 15초쯤 지나 차가 보입니다.");
        }
        return next;
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase]);

  function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const command = input.trim();
    if (!command) return;
    runCommand(command);
    setInput("");
  }

  function runCommand(command: string) {
    if (phase === "living") {
      if (callWords.includes(command)) {
        setCalledDogs(true);
        playSound("happy");
        showHearts("루비와 감자가 고개를 들고 나에게 다가와요.");
      } else if (walkWords.includes(command)) {
        setPhase("excited");
        showHearts("산책이라는 말에 루비와 감자가 콩콩 뛰기 시작했어요!");
      } else {
        setMessage("아직 반응이 약해요. 이름을 부르거나 산책 말을 해보세요.");
      }
      return;
    }
    if (phase === "leashPrep") {
      if (command === "앉아") sitDogs();
      else setMessage("목줄을 채우려면 먼저 앉아가 필요해요.");
    }
  }

  function sitDogs() {
    setDogsSitting(true);
    playSound("success");
    showHearts("루비와 감자가 얌전히 앉았어요.");
  }

  function startLeash() {
    if (!dogsSitting) {
      setMessage("먼저 앉아를 해야 목줄을 안전하게 채울 수 있어요.");
      return;
    }
    setPhase("leashMission");
    setTimeLeft(10);
    playSound("leash");
    setMessage("강아지 목을 클릭하면 확대됩니다. 목줄을 드래그해서 채워주세요.");
  }

  function openLeashZoom(target: Dog) {
    if ((target === "ruby" && rubyLeashed) || (target === "gamja" && gamjaLeashed)) {
      setMessage(`${target === "ruby" ? "루비" : "감자"}는 이미 목줄을 찼어요.`);
      return;
    }
    setZoomDog(target);
    setPhase("leashZoom");
    playSound("leash");
    setMessage(`${target === "ruby" ? "루비" : "감자"} 목 부분 확대. 목줄을 고리로 드래그하세요.`);
  }

  function finishLeash(target: Dog) {
    if (target === "ruby") setRubyLeashed(true);
    if (target === "gamja") setGamjaLeashed(true);
    playSound("leash");
    const nextRuby = target === "ruby" || rubyLeashed;
    const nextGamja = target === "gamja" || gamjaLeashed;
    setZoomDog(null);
    if (nextRuby && nextGamja) {
      setTimeLeft(null);
      setPhase("poopBag");
      showHearts("목줄 착용 완료! 이제 똥봉투를 확인하세요.");
    } else {
      setPhase("leashMission");
      setMessage("좋아요. 다른 강아지도 목을 클릭해서 목줄을 채워주세요.");
    }
  }

  function goOut() {
    if (!hasPoopBag && !poopBagWarning) {
      setPoopBagWarning(true);
      setMessage("뭐 잊은 게 있지 않니?");
      return;
    }
      setPhase("garden");
    playSound("step");
    setMessage(hasPoopBag ? "똥봉투까지 챙겼어요. 정원으로 나갑니다." : "똥봉투 없이 나왔어요. 나중에 선택지가 생길 수 있어요.");
  }

  function openGate() {
    if (!rubyCalm || !gamjaQuiet) {
      fall("대문을 그냥 열자 루비가 돌고 감자가 짖어서 넘어졌어요.");
      setPhase("gate");
      return;
    }
    setPhase("walk");
    playSound("step");
    setMessage("안전하게 대문을 나섰어요. 늘 가던 산책길입니다.");
  }

  function resumeWalk(text: string) {
    setWalkStep((current) => current + 1);
    setPhase("walk");
    showHearts(text);
  }

  function choosePoopTool(tool: PoopTool) {
    setPoopTool(tool);
    playSound("poop");
    if (tool === "leaf") setMessage("나뭇잎을 똥 위로 드래그해보세요.");
    if (tool === "sock") setMessage("양말을 벗었습니다. 양말을 똥 위로 드래그하세요.");
    if (tool === "bag") setMessage("똥봉투를 똥 위로 드래그하세요.");
  }

  function dropPoopTool() {
    if (poopTool === "bag") {
      resumeWalk("펫티켓 완료!");
    } else if (poopTool === "leaf") {
      setPoopTool(null);
      setMessage("나뭇잎이 너무 작네요. 손에 묻었습니다. 양말을 벗으시겠습니까?");
    } else if (poopTool === "sock") {
      resumeWalk("양말은 잃었지만 펫티켓은 지켰습니다!");
    } else {
      setMessage("먼저 처리할 도구를 선택하세요.");
    }
  }

  function ignoreDog() {
    setTimeLeft(null);
    playSound("bark");
    resumeWalk("무시해 성공! 루비와 감자가 조용히 지나갔어요.");
  }

  function blockBoss() {
    setTimeLeft(null);
    playSound("bark");
    setWalkStep(5);
    setPhase("home");
    showHearts("사나운 강아지로부터 귀여운 루감이를 지켜냈어요.");
  }

  function finishCar() {
    if (!carStopped) {
      setMessage("먼저 멈춰를 클릭해야 해요.");
      return;
    }
    if (!dogsRoadside) {
      setMessage("강아지들을 길 옆 안전 구역으로 드래그해야 해요.");
      return;
    }
    resumeWalk("루감이를 안전하게 지켜냈어요!");
  }

  useEffect(() => {
    if (phase === "gate" || phase === "barkingDog" || phase === "boss") playSound("bark");
    if (phase === "car") playSound("car");
    if (phase === "poop") playSound("poop");
    if (phase === "run") playSound("happy");
  }, [phase]);

  const dogPose = useMemo(() => {
    if (phase === "intro" || phase === "clear") return "heart";
    if (phase === "living" && !calledDogs) return "sleep";
    if (phase === "excited" || phase === "leashPrep") return dogsSitting ? "sit" : "hop";
    if (phase === "leashMission" || phase === "leashZoom" || phase === "gate") return "sit";
    if (phase === "pull" || phase === "run") return "run";
    if (phase === "poop") return "poop";
    if (phase === "barkingDog" || phase === "boss" || phase === "car") return "alert";
    return "walk";
  }, [calledDogs, dogsSitting, phase]);

  return (
    <main className="walk-page">
      <Link href="/" className="back-link">← 메인으로</Link>
      <section className="game">
        <header className="topbar">
          <div>
            <p>현실형 1인칭 강아지 산책 시뮬레이션</p>
            <h1>루비 감자와 산책</h1>
          </div>
          <div className="hud-pills">
            <Pill label="넘어짐" value={`${falls}/3`} alert={falls > 0} />
            <Pill label="시간" value={timeLeft === null ? "-" : `${timeLeft}s`} alert={timeLeft !== null && timeLeft <= 3} />
            <Pill label="루비 목줄" value={rubyLeashed ? "착용" : "미착용"} />
            <Pill label="감자 목줄" value={gamjaLeashed ? "착용" : "미착용"} />
            <Pill label="똥봉투" value={hasPoopBag ? "보유" : "없음"} alert={!hasPoopBag && phase === "poop"} />
          </div>
        </header>

        <section className={`scene bg-${info.bg}`}>
          <div className="first-person" />
          <SceneFurniture phase={phase} />
          <DogLayer pose={dogPose} phase={phase} rubyCalm={rubyCalm} hearts={hearts || phase === "clear"} peePulse={peePulse} />
          <SceneContent
            phase={phase}
            timeLeft={timeLeft}
            runTaps={runTaps}
            rubyLeashed={rubyLeashed}
            gamjaLeashed={gamjaLeashed}
            zoomDog={zoomDog}
            hasPoopBag={hasPoopBag}
            poopBagWarning={poopBagWarning}
            rubyCalm={rubyCalm}
            gamjaQuiet={gamjaQuiet}
            poopTool={poopTool}
            carStopped={carStopped}
            dogsRoadside={dogsRoadside}
            start={start}
            reset={reset}
            setPhase={setPhase}
            setMessage={setMessage}
            sitDogs={sitDogs}
            startLeash={startLeash}
            openLeashZoom={openLeashZoom}
            finishLeash={finishLeash}
            setHasPoopBag={setHasPoopBag}
            goOut={goOut}
            setRubyCalm={setRubyCalm}
            setGamjaQuiet={setGamjaQuiet}
            openGate={openGate}
            resumeWalk={resumeWalk}
            fall={fall}
            choosePoopTool={choosePoopTool}
            dropPoopTool={dropPoopTool}
            setCarStopped={setCarStopped}
            setDogsRoadside={setDogsRoadside}
            finishCar={finishCar}
            ignoreDog={ignoreDog}
            blockBoss={blockBoss}
          />
          {needsInput && (
            <form className="command" onSubmit={submitCommand}>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={phase === "living" ? "루비 / 감자 / 산책가자 / 나가자 / 나갈까" : "앉아"}
                autoFocus
              />
              <button type="submit">말하기</button>
            </form>
          )}
        </section>

        <footer className="mission">
          <div>
            <b>{info.scene}</b>
            <p>{info.mission}</p>
          </div>
          <strong>{message}</strong>
        </footer>
      </section>

      <style jsx>{`
        .walk-page {
          min-height: 100vh;
          padding: 24px;
          background: linear-gradient(135deg, #ebe1d6, #d8e2df);
          color: #231a15;
          font-family: "Jua", "NanumSquareRound", "Pretendard", "Segoe UI", sans-serif;
        }

        .back-link {
          color: #60442f;
          font-weight: 900;
          text-decoration: none;
        }

        .game {
          max-width: 1180px;
          margin: 18px auto 0;
          border: 1px solid rgba(74, 52, 38, 0.16);
          border-radius: 22px;
          background: rgba(255, 250, 244, 0.94);
          overflow: hidden;
          box-shadow: 0 24px 70px rgba(37, 28, 22, 0.16);
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 18px;
          padding: 20px 22px 16px;
          border-bottom: 1px solid rgba(74, 52, 38, 0.12);
        }

        .topbar p {
          margin: 0 0 6px;
          color: #896046;
          font-size: 0.86rem;
          font-weight: 900;
        }

        h1 {
          margin: 0;
          font-size: clamp(1.75rem, 4vw, 2.8rem);
          letter-spacing: 0;
          text-shadow: 0 2px 0 rgba(255, 255, 255, 0.8);
        }

        .hud-pills {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        .scene {
          position: relative;
          min-height: 650px;
          overflow: hidden;
          background: #f2eee8;
        }

        .scene::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(24, 18, 15, 0.33), transparent 35%, rgba(24, 18, 15, 0.12));
          pointer-events: none;
        }

        .bg-home {
          background:
            radial-gradient(circle at 72% 18%, rgba(255,255,255,0.8), transparent 18rem),
            linear-gradient(180deg, #f4f1ed 0 48%, transparent 48%),
            repeating-linear-gradient(42deg, rgba(180,171,160,0.18) 0 2px, transparent 2px 72px),
            linear-gradient(180deg, #fbfaf7 0 50%, #e9e4dc 50% 100%);
        }

        .bg-stairs {
          background:
            radial-gradient(circle at 78% 18%, rgba(255,255,255,0.72), transparent 18rem),
            linear-gradient(180deg, #f7f3ee 0 38%, transparent 38%),
            repeating-linear-gradient(42deg, rgba(173,164,154,0.16) 0 2px, transparent 2px 64px),
            linear-gradient(180deg, #fbfaf7 0 48%, #eee8df 48% 100%);
        }

        .bg-living,
        .bg-entry {
          background:
            radial-gradient(circle at 72% 22%, rgba(255,255,255,0.8), transparent 18rem),
            linear-gradient(180deg, #f6f1e9 0 50%, transparent 50%),
            repeating-linear-gradient(35deg, rgba(171,162,152,0.18) 0 2px, transparent 2px 68px),
            linear-gradient(180deg, #fbfaf8 0 50%, #ece6dd 50% 100%);
        }

        .bg-garden,
        .bg-gate {
          background:
            radial-gradient(circle at 50% 20%, rgba(255,255,255,0.72), transparent 16rem),
            linear-gradient(180deg, #e7eee8 0 47%, #93b481 47% 100%);
        }

        .bg-street,
        .bg-road,
        .bg-fence {
          background:
            linear-gradient(180deg, #bacbcd 0 42%, #717772 42% 100%),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0 90px, transparent 90px 180px);
        }

        .first-person {
          position: absolute;
          left: 50%;
          bottom: -56px;
          width: min(620px, 92vw);
          height: 150px;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(31, 24, 20, 0.3), transparent 68%);
          transform: translateX(-50%);
        }

        .command {
          position: absolute;
          z-index: 20;
          left: 50%;
          bottom: 24px;
          display: flex;
          gap: 10px;
          width: min(560px, calc(100% - 32px));
          padding: 10px;
          border-radius: 18px;
          background: rgba(255, 250, 242, 0.92);
          box-shadow: 0 18px 48px rgba(0,0,0,0.24);
          transform: translateX(-50%);
        }

        input {
          flex: 1;
          min-width: 0;
          border: 1px solid rgba(80, 55, 40, 0.22);
          border-radius: 13px;
          padding: 13px;
          font: inherit;
          font-weight: 850;
        }

        button {
          border: 0;
          border-radius: 13px;
          padding: 12px 16px;
          background: #2f6f2d;
          color: white;
          font: inherit;
          font-weight: 950;
          cursor: pointer;
        }

        .mission {
          display: grid;
          grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
          gap: 18px;
          padding: 16px 22px 20px;
          background: rgba(255, 249, 240, 0.78);
        }

        .mission b {
          display: block;
          margin-bottom: 6px;
        }

        .mission p,
        .mission strong {
          margin: 0;
          line-height: 1.55;
        }

        .mission strong {
          color: #60442f;
        }

        @media (max-width: 820px) {
          .walk-page {
            padding: 12px;
          }

          .topbar,
          .mission {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: stretch;
          }

          .scene {
            min-height: 610px;
          }
        }
      `}</style>
    </main>
  );
}

function Pill({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
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
          border: 1px solid rgba(74, 52, 38, 0.16);
          background: #fffaf3;
          font-weight: 900;
        }
        small {
          color: #8c7564;
          font-size: 0.72rem;
        }
        .alert {
          background: #fff0ea;
          color: #a7392d;
        }
      `}</style>
    </span>
  );
}

function DogLayer({
  pose,
  phase,
  rubyCalm,
  hearts,
  peePulse,
}: {
  pose: string;
  phase: Phase;
  rubyCalm: boolean;
  hearts: boolean;
  peePulse: boolean;
}) {
  const rubySrc = dog.ruby[pose as keyof typeof dog.ruby] || dog.ruby.walk;
  const gamjaSrc = dog.gamja[pose as keyof typeof dog.gamja] || dog.gamja.walk;
  const rubySpinning = phase === "gate" && !rubyCalm;
  return (
    <div className={`dogs dogs-${pose} ${rubySpinning ? "dogs-spin" : ""}`}>
      <DogSprite src={rubySrc} name="루비" side="left" hearts={hearts} spinning={rubySpinning} />
      <DogSprite src={peePulse ? dog.gamja.pee : gamjaSrc} name="감자" side="right" hearts={hearts} />
      {peePulse && <div className="pee-mark">영역 표시 중</div>}
      <style jsx>{`
        .dogs {
          position: absolute;
          z-index: 8;
          left: 50%;
          bottom: 80px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: clamp(24px, 7vw, 92px);
          width: min(780px, 94%);
          transform: translateX(-50%);
          pointer-events: none;
        }
        .dogs-sleep {
          bottom: 110px;
        }
        .dogs-hop {
          animation: hop 0.45s ease-in-out infinite alternate;
        }
        .dogs-run {
          animation: run 0.28s ease-in-out infinite alternate;
        }
        .dogs-spin {
          bottom: 104px;
        }
        .pee-mark {
          position: absolute;
          right: 18%;
          bottom: 0;
          padding: 7px 11px;
          border-radius: 999px;
          background: rgba(255,248,239,0.9);
          color: #77512f;
          font-weight: 900;
        }
        @keyframes hop {
          to { transform: translateX(-50%) translateY(-18px); }
        }
        @keyframes run {
          to { transform: translateX(-50%) translateY(-8px) scale(1.02); }
        }
      `}</style>
    </div>
  );
}

function DogSprite({
  src,
  name,
  side,
  hearts,
  spinning = false,
}: {
  src: string;
  name: string;
  side: "left" | "right";
  hearts: boolean;
  spinning?: boolean;
}) {
  return (
    <figure className={`sprite ${side} ${spinning ? "spinning" : ""}`}>
      {hearts && <span className="heart">♥</span>}
      <Image src={src} alt={name} fill sizes="300px" />
      <figcaption>{name}</figcaption>
      <style jsx>{`
        .sprite {
          position: relative;
          width: clamp(160px, 23vw, 250px);
          height: clamp(190px, 30vw, 320px);
          margin: 0;
          filter: drop-shadow(0 22px 25px rgba(0,0,0,0.34));
        }
        .sprite :global(img) {
          object-fit: contain;
        }
        figcaption {
          position: absolute;
          left: 50%;
          bottom: -14px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255,250,242,0.92);
          color: #2c211a;
          font-weight: 950;
          transform: translateX(-50%);
        }
        .heart {
          position: absolute;
          z-index: 2;
          left: 50%;
          top: -24px;
          color: #ef5f86;
          font-size: 2.4rem;
          text-shadow: 0 5px 12px rgba(0,0,0,0.25);
          transform: translateX(-50%);
          animation: heartPop 0.8s ease-in-out infinite alternate;
        }
        .spinning {
          animation: sideSpin 0.62s ease-in-out infinite;
          transform-origin: 50% 82%;
        }
        .spinning :global(img) {
          transform: rotateY(56deg) rotateZ(-8deg);
        }
        @keyframes heartPop {
          to { transform: translateX(-50%) translateY(-8px) scale(1.12); }
        }
        @keyframes sideSpin {
          0%, 100% { transform: rotate(-5deg) translateX(-6px); }
          50% { transform: rotate(11deg) translateX(10px); }
        }
      `}</style>
    </figure>
  );
}

function SceneFurniture({ phase }: { phase: Phase }) {
  return (
    <div className="furniture">
      {["living", "excited"].includes(phase) && (
        <>
          <div className="sofa" />
          <div className="rug" />
          <div className="plant" />
        </>
      )}
      {["poopBag", "leashPrep", "leashMission", "leashZoom"].includes(phase) && (
        <>
          <div className="shoe-cabinet" />
          <div className="mirror" />
        </>
      )}
      {phase === "upstairs" && <div className="stairs-real">{Array.from({ length: 8 }).map((_, i) => <span key={i} />)}</div>}
      {["poopBag", "leashPrep", "leashMission"].includes(phase) && <div className="entry-table" />}
      {["garden", "gate", "home"].includes(phase) && <div className="gate-shape" />}
      {["walk", "pull", "poop", "run", "car", "barkingDog", "boss"].includes(phase) && <div className="road-perspective" />}
      <style jsx>{`
        .furniture {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
        }
        .stairs-real {
          position: absolute;
          left: 8%;
          right: 12%;
          bottom: -20px;
          perspective: 680px;
        }
        .stairs-real span {
          display: block;
          height: 44px;
          margin: 0 auto 10px;
          width: calc(92% - var(--n, 0px));
          border-radius: 5px;
          background: linear-gradient(180deg, #b57c4f, #5f3b27);
          box-shadow: 0 14px 24px rgba(0,0,0,0.24);
          transform: rotateX(58deg);
        }
        .stairs-real span:nth-child(2n) { width: 82%; }
        .stairs-real span:nth-child(3n) { width: 72%; }
        .entry-table {
          position: absolute;
          top: 118px;
          right: 8%;
          width: 340px;
          height: 120px;
          border-radius: 16px;
          background: linear-gradient(180deg, #7b5237, #3d261c);
          box-shadow: 0 20px 48px rgba(0,0,0,0.3);
        }
        .sofa {
          position: absolute;
          left: 7%;
          bottom: 215px;
          width: min(380px, 42vw);
          height: 132px;
          border-radius: 32px 32px 18px 18px;
          background: linear-gradient(180deg, #d9c4ae, #a3836c);
          box-shadow: 0 22px 40px rgba(80, 58, 43, 0.22);
        }
        .sofa::before {
          content: "";
          position: absolute;
          left: 24px;
          right: 24px;
          top: -34px;
          height: 72px;
          border-radius: 24px;
          background: #e7d8c6;
        }
        .rug {
          position: absolute;
          left: 13%;
          bottom: 74px;
          width: min(480px, 54vw);
          height: 110px;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(188, 144, 117, 0.36), rgba(188, 144, 117, 0.08) 70%);
        }
        .plant {
          position: absolute;
          right: 10%;
          bottom: 205px;
          width: 70px;
          height: 150px;
          border-radius: 0 0 18px 18px;
          background: linear-gradient(180deg, transparent 0 55%, #b58a63 55% 100%);
        }
        .plant::before {
          content: "";
          position: absolute;
          left: -36px;
          right: -36px;
          top: 0;
          height: 104px;
          background:
            radial-gradient(ellipse at 30% 50%, #6f9c5d 0 38%, transparent 39%),
            radial-gradient(ellipse at 60% 35%, #7fb36d 0 36%, transparent 37%),
            radial-gradient(ellipse at 70% 70%, #5f8f50 0 34%, transparent 35%);
        }
        .shoe-cabinet {
          position: absolute;
          right: 7%;
          bottom: 155px;
          width: min(360px, 42vw);
          height: 158px;
          border-radius: 18px;
          background: linear-gradient(180deg, #f2eee8, #cdbda9);
          box-shadow: 0 20px 40px rgba(80, 58, 43, 0.2);
        }
        .shoe-cabinet::before {
          content: "";
          position: absolute;
          left: 20px;
          right: 20px;
          top: 48%;
          height: 2px;
          background: rgba(102, 73, 52, 0.28);
        }
        .mirror {
          position: absolute;
          right: 11%;
          top: 70px;
          width: 130px;
          height: 210px;
          border-radius: 999px 999px 18px 18px;
          border: 8px solid rgba(190, 174, 154, 0.75);
          background: linear-gradient(135deg, rgba(255,255,255,0.7), rgba(202,222,226,0.34));
        }
        .gate-shape {
          position: absolute;
          left: 50%;
          bottom: 92px;
          width: min(420px, 70vw);
          height: 260px;
          border: 10px solid rgba(78,48,30,0.75);
          border-radius: 20px 20px 8px 8px;
          background: rgba(105,65,40,0.46);
          transform: translateX(-50%);
        }
        .road-perspective {
          position: absolute;
          left: -10%;
          right: -10%;
          bottom: -20%;
          height: 52%;
          background: linear-gradient(#777, #252525);
          transform: perspective(430px) rotateX(62deg);
          transform-origin: bottom;
        }
      `}</style>
    </div>
  );
}

function SceneContent(props: {
  phase: Phase;
  timeLeft: number | null;
  runTaps: number;
  rubyLeashed: boolean;
  gamjaLeashed: boolean;
  zoomDog: Dog | null;
  hasPoopBag: boolean;
  poopBagWarning: boolean;
  rubyCalm: boolean;
  gamjaQuiet: boolean;
  poopTool: PoopTool;
  carStopped: boolean;
  dogsRoadside: boolean;
  start: () => void;
  reset: () => void;
  setPhase: (phase: Phase) => void;
  setMessage: (message: string) => void;
  sitDogs: () => void;
  startLeash: () => void;
  openLeashZoom: (dog: Dog) => void;
  finishLeash: (dog: Dog) => void;
  setHasPoopBag: (value: boolean) => void;
  goOut: () => void;
  setRubyCalm: (value: boolean) => void;
  setGamjaQuiet: (value: boolean) => void;
  openGate: () => void;
  resumeWalk: (message: string) => void;
  fall: (reason: string) => void;
  choosePoopTool: (tool: PoopTool) => void;
  dropPoopTool: () => void;
  setCarStopped: (value: boolean) => void;
  setDogsRoadside: (value: boolean) => void;
  finishCar: () => void;
  ignoreDog: () => void;
  blockBoss: () => void;
}) {
  const p = props;
  if (p.phase === "intro") {
    return <CenterCard title="루비 감자와 산책" body="현실형 1인칭 산책 미션을 시작합니다." button="Start" onClick={p.start} image={dog.duo} />;
  }
  if (p.phase === "upstairs") {
    return <ActionDock><button onClick={() => { p.setPhase("living"); p.setMessage("1층 거실입니다. 루비와 감자를 불러보세요."); }}>계단 내려가기</button></ActionDock>;
  }
  if (p.phase === "living") {
    return <ActionDock><button onClick={() => p.setMessage("화면 아래 입력창에 루비, 감자, 산책가자, 나가자, 나갈까를 입력해보세요.")}>불러보기</button></ActionDock>;
  }
  if (p.phase === "excited") {
    return <ActionDock><button onClick={() => p.setPhase("leashPrep")}>현관으로 가기</button></ActionDock>;
  }
  if (p.phase === "leashPrep") {
    return <ActionDock><button onClick={p.sitDogs}>앉아</button><button onClick={p.startLeash}>목줄 채우기</button></ActionDock>;
  }
  if (p.phase === "leashMission") {
    return (
      <ActionDock>
        <button disabled={p.rubyLeashed} onClick={() => p.openLeashZoom("ruby")}>루비 목 클릭</button>
        <button disabled={p.gamjaLeashed} onClick={() => p.openLeashZoom("gamja")}>감자 목 클릭</button>
      </ActionDock>
    );
  }
  if (p.phase === "leashZoom" && p.zoomDog) {
    return <LeashZoom dogKey={p.zoomDog} finish={p.finishLeash} />;
  }
  if (p.phase === "poopBag") {
    return (
      <ActionDock>
        <button onClick={() => { p.setHasPoopBag(true); p.setMessage("똥봉투를 챙겼어요."); }}>똥봉투 챙기기</button>
        <button onClick={p.goOut}>{p.poopBagWarning ? "그래도 나가기" : "나가기"}</button>
      </ActionDock>
    );
  }
  if (p.phase === "garden") {
    return <ActionDock><button onClick={() => p.setPhase("gate")}>대문 앞으로</button></ActionDock>;
  }
  if (p.phase === "gate") {
    return (
      <ActionDock>
        <button className={p.rubyCalm ? "done" : ""} onClick={() => { playSound("success"); p.setRubyCalm(true); p.setMessage("루비가 빙글빙글 돌다가 앉았어요."); }}>앉아</button>
        <button className={p.gamjaQuiet ? "done" : ""} onClick={() => { playSound("bark"); p.setGamjaQuiet(true); p.setMessage("감자가 짖음을 멈췄어요."); }}>조용히 해</button>
        <button onClick={p.openGate}>대문 열기</button>
      </ActionDock>
    );
  }
  if (p.phase === "pull") {
    return <ActionDock><button onClick={() => p.resumeWalk("루비가 속도를 줄였어요.")}>천천히</button></ActionDock>;
  }
  if (p.phase === "poop") {
    return <PoopTools hasPoopBag={p.hasPoopBag} tool={p.poopTool} choose={p.choosePoopTool} drop={p.dropPoopTool} />;
  }
  if (p.phase === "run") {
    return <ActionDock><span className="counter">Space {p.runTaps}/18</span></ActionDock>;
  }
  if (p.phase === "car") {
    return (
      <ActionDock>
        <button className={p.carStopped ? "done" : ""} onClick={() => { playSound("car"); p.setCarStopped(true); p.setMessage("멈췄어요. 이제 길 옆으로 이동!"); }}>멈춰</button>
        <div
          className={p.dogsRoadside ? "drop-zone done" : "drop-zone"}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => p.setDogsRoadside(true)}
        >
          길 옆 안전 구역
        </div>
        <div
          draggable
          className="drag-chip"
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", "dogs-roadside");
          }}
        >
          루감이 드래그
        </div>
        <button onClick={p.finishCar}>기다려</button>
      </ActionDock>
    );
  }
  if (p.phase === "barkingDog") {
    return <ActionDock><button onClick={p.ignoreDog}>무시해</button></ActionDock>;
  }
  if (p.phase === "boss") {
    return <ActionDock><button onClick={p.blockBoss}>블로킹</button></ActionDock>;
  }
  if (p.phase === "home") {
    return <ActionDock><button onClick={() => p.setPhase("clear")}>집 문 열기</button></ActionDock>;
  }
  if (p.phase === "clear") {
    return <CenterCard title="산책 완료!" body="산책 완료! 루비와 감자가 행복해 보여요." button="다시 하기" onClick={p.reset} image={dog.duo} />;
  }
  if (p.phase === "fail") {
    return <CenterCard title="산책 실패..." body="다시 도전해볼까요?" button="Restart" onClick={p.reset} image={dog.duo} />;
  }
  return null;
}

function LeashZoom({ dogKey, finish }: { dogKey: Dog; finish: (dog: Dog) => void }) {
  const src = dogKey === "ruby" ? dog.ruby.sit : dog.gamja.sit;
  return (
    <div className="zoom">
      <div className="dog-close">
        <Image src={src} alt="목줄 확대" fill sizes="520px" />
        <div
          className="collar"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            finish(dogKey);
          }}
        >
          고리
        </div>
      </div>
      <div
        draggable
        className="leash"
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", `${dogKey}-leash`);
          event.dataTransfer.effectAllowed = "move";
        }}
      >
        <span />
        목줄 드래그
      </div>
      <style jsx>{`
        .zoom {
          position: absolute;
          z-index: 30;
          inset: 70px 6% 92px;
          display: grid;
          grid-template-columns: minmax(260px, 520px) 180px;
          gap: 24px;
          align-items: center;
          justify-content: center;
        }
        .dog-close {
          position: relative;
          height: min(500px, 66vh);
          border-radius: 28px;
          background: rgba(255,248,239,0.35);
          filter: drop-shadow(0 30px 35px rgba(0,0,0,0.32));
        }
        .dog-close :global(img) { object-fit: contain; }
        .collar {
          position: absolute;
          left: 50%;
          top: 61%;
          display: grid;
          place-items: center;
          width: 130px;
          height: 78px;
          border: 3px dashed #ffe3a3;
          border-radius: 999px;
          background: rgba(0,0,0,0.28);
          color: white;
          font-weight: 950;
          transform: translate(-50%, -50%);
        }
        .leash {
          display: grid;
          place-items: center;
          gap: 8px;
          min-height: 88px;
          border-radius: 22px;
          background: linear-gradient(135deg, #fff7ec, #f0c7a3);
          color: #4b3024;
          font-weight: 950;
          cursor: grab;
          box-shadow: 0 18px 42px rgba(0,0,0,0.25);
          user-select: none;
        }
        .leash span {
          width: 62px;
          height: 42px;
          border: 7px solid #c46e7e;
          border-radius: 50%;
          box-shadow:
            0 0 0 4px rgba(255,255,255,0.7) inset,
            18px 10px 0 -8px #6d4938;
        }
      `}</style>
    </div>
  );
}

function PoopTools({ hasPoopBag, tool, choose, drop }: { hasPoopBag: boolean; tool: PoopTool; choose: (tool: PoopTool) => void; drop: () => void }) {
  return (
    <div className="poop-ui">
      <div
        className="poop-target"
        onDragOver={(event) => event.preventDefault()}
        onDrop={drop}
      >
        감자 똥
      </div>
      <div className="choices">
        {hasPoopBag ? <button onClick={() => choose("bag")}>똥봉투 사용</button> : (
          <>
            <button onClick={() => choose("leaf")}>나뭇잎 줍기</button>
            <button onClick={() => choose("sock")}>양말을 벗으시겠습니까?</button>
          </>
        )}
        {tool && (
          <div
            draggable
            className="drag-chip"
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", tool);
            }}
          >
            {tool === "bag" ? "똥봉투" : tool === "leaf" ? "나뭇잎" : "양말"} 드래그
          </div>
        )}
      </div>
      <style jsx>{`
        .poop-ui {
          position: absolute;
          z-index: 20;
          inset: auto 24px 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
        }
        .poop-target,
        .choices {
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,250,242,0.92);
          box-shadow: 0 16px 38px rgba(0,0,0,0.22);
          font-weight: 950;
        }
        .choices {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
}

function ActionDock({ children }: { children: React.ReactNode }) {
  return (
    <div className="dock">
      {children}
      <style jsx>{`
        .dock {
          position: absolute;
          z-index: 20;
          left: 50%;
          bottom: 24px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: min(720px, calc(100% - 32px));
          padding: 12px;
          border-radius: 20px;
          background: rgba(255,250,242,0.92);
          box-shadow: 0 18px 48px rgba(0,0,0,0.24);
          transform: translateX(-50%);
        }
        .dock :global(.done) {
          background: #dff0d4;
          color: #2f6f2d;
        }
        .dock :global(.counter),
        .dock :global(.drag-chip),
        .dock :global(.drop-zone) {
          padding: 12px 14px;
          border-radius: 14px;
          background: #fff4df;
          color: #4c3828;
          font-weight: 950;
        }
        .dock :global(.drag-chip) {
          cursor: grab;
          background: #f1c69d;
        }
      `}</style>
    </div>
  );
}

function CenterCard({ title, body, button, onClick, image }: { title: string; body: string; button: string; onClick: () => void; image: string }) {
  return (
    <div className="center-card">
      <div className="hero-dogs"><Image src={image} alt="루비와 감자" fill sizes="520px" priority /></div>
      <h2>{title}</h2>
      <p>{body}</p>
      <button onClick={onClick}>{button}</button>
      <style jsx>{`
        .center-card {
          position: absolute;
          z-index: 30;
          left: 50%;
          top: 50%;
          width: min(560px, calc(100% - 32px));
          padding: 28px;
          border-radius: 30px;
          background: rgba(255,250,242,0.9);
          text-align: center;
          box-shadow: 0 28px 72px rgba(0,0,0,0.3);
          transform: translate(-50%, -50%);
        }
        .hero-dogs {
          position: relative;
          height: 220px;
          margin-bottom: 8px;
          filter: drop-shadow(0 18px 22px rgba(0,0,0,0.24));
        }
        .hero-dogs :global(img) { object-fit: contain; }
        h2 {
          margin: 0 0 10px;
          font-size: clamp(2rem, 6vw, 4rem);
        }
        p {
          margin: 0 0 18px;
          color: #675346;
          font-weight: 850;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}
