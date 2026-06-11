"use client";

import Image from "next/image";
import Link from "next/link";
import { type DragEvent as ReactDragEvent, FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

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
    call: "/ruby-gamja/custom/ruby-approach.png",
    hop: "/ruby-gamja/custom/ruby-approach.png",
    stairs: "/ruby-gamja/cutouts-v2/ruby-stairs.png",
    sleep: "/ruby-gamja/custom/ruby-sleep.png",
    sit: "/ruby-gamja/cutouts-v2/ruby-sit.png",
    walk: "/ruby-gamja/cutouts-v2/ruby-walk.png",
    alert: "/ruby-gamja/cutouts-v2/ruby-alert.png",
    run: "/ruby-gamja/cutouts-v2/ruby-run.png",
    heart: "/ruby-gamja/cutouts-v2/ruby-heart.png",
  },
  gamja: {
    call: "/ruby-gamja/custom/gamja-approach.png",
    hop: "/ruby-gamja/custom/gamja-approach.png",
    stairs: "/ruby-gamja/cutouts-v3/gamja-stairs.png",
    sleep: "/ruby-gamja/custom/gamja-sleep.png",
    sit: "/ruby-gamja/cutouts-v3/gamja-sit.png",
    walk: "/ruby-gamja/cutouts-v3/gamja-walk.png",
    alert: "/ruby-gamja/cutouts-v3/gamja-alert.png",
    run: "/ruby-gamja/cutouts-v3/gamja-run.png",
    pee: "/ruby-gamja/cutouts-v3/gamja-pee.png",
    poop: "/ruby-gamja/cutouts-v3/gamja-poop.png",
    heart: "/ruby-gamja/cutouts-v3/gamja-heart.png",
  },
  intro: "/ruby-gamja/custom/intro-ruby-gamja.jpg",
  duo: "/ruby-gamja/custom/intro-ruby-gamja.jpg",
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

const callWords = ["루비", "감자", "루감"];
const walkWords = ["산책", "나가자", "나갈까"];

const phaseInfo: Record<Phase, { scene: string; mission: string; bg: string }> = {
  intro: { scene: "우리집", mission: "Start 버튼을 눌러 산책을 시작하세요.", bg: "home" },
  upstairs: { scene: "2층 계단", mission: "계단을 내려가 1층으로 이동하세요.", bg: "stairs" },
  living: { scene: "1층 거실", mission: "루비 또는 감자를 부르고, 산책 말을 해보세요.", bg: "living" },
  excited: { scene: "거실", mission: "강아지들이 신났어요. 이제 목줄을 준비하세요.", bg: "living" },
  leashPrep: { scene: "현관", mission: "먼저 앉아를 입력/클릭한 뒤 목줄 미션을 시작하세요.", bg: "entry" },
  leashMission: { scene: "현관", mission: "10초 안에 선반의 목줄을 루비와 감자에게 채워주세요.", bg: "entry" },
  leashZoom: { scene: "목줄 확대", mission: "목줄을 목 고리까지 옮겨 채우세요.", bg: "entry" },
  poopBag: { scene: "현관문", mission: "똥봉투를 챙기거나 바로 정원으로 나가세요.", bg: "entry" },
  garden: { scene: "정원", mission: "정원을 지나 대문 앞으로 가세요.", bg: "garden" },
  gate: { scene: "대문 앞", mission: "루비는 앉아, 감자는 조용히 해. 진정 후 대문을 여세요.", bg: "gate" },
  walk: { scene: "늘 가던 산책길", mission: "루비와 감자를 따라 안전하게 걸으세요.", bg: "street" },
  pull: { scene: "산책길", mission: "루비가 당겨요. 5초 안에 천천히를 클릭하세요.", bg: "street" },
  poop: { scene: "산책길", mission: "감자 똥을 처리하세요.", bg: "street" },
  run: { scene: "산책길", mission: "스페이스바를 빠르게 눌러 속도를 따라가세요.", bg: "street" },
  car: { scene: "차 오는 골목", mission: "멈춰 → 길 옆으로 이동 → 기다려 순서로 처리하세요.", bg: "road" },
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
  const showDogs = !["intro", "upstairs", "clear", "fail"].includes(phase) && !(phase === "living" && !calledDogs);
  const useEmptyHome = (phase === "living" && calledDogs) || phase === "excited";

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
      if (callWords.some((word) => command.includes(word))) {
        setCalledDogs(true);
        playSound("happy");
        showHearts("루비와 감자가 고개를 들고 나에게 다가와요.");
      } else if (walkWords.some((word) => command.includes(word))) {
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
    setMessage("선반의 목줄을 루비와 감자에게 각각 채워주세요.");
  }

  function openLeashZoom(target: Dog) {
    if ((target === "ruby" && rubyLeashed) || (target === "gamja" && gamjaLeashed)) {
      setMessage(`${target === "ruby" ? "루비" : "감자"}는 이미 목줄을 찼어요.`);
      return;
    }
    setZoomDog(target);
    setPhase("leashZoom");
    playSound("leash");
    setMessage(`${target === "ruby" ? "루비" : "감자"} 목 부분 확대. 목줄을 고리로 옮겨주세요.`);
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
    setPhase("garden");
    playSound("step");
    setMessage(hasPoopBag ? "똥봉투까지 챙겼어요. 정원으로 나갑니다." : "똥봉투 없이도 정원으로 나왔어요.");
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
    if (tool === "leaf") setMessage("나뭇잎을 똥 위로 옮겨보세요.");
    if (tool === "sock") setMessage("양말을 벗었습니다. 양말을 똥 위로 옮겨주세요.");
    if (tool === "bag") setMessage("똥봉투를 똥 위로 옮겨주세요.");
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
      setMessage("강아지들을 길 옆 안전 구역으로 옮겨야 해요.");
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
    if (phase === "excited" || phase === "leashPrep") return dogsSitting ? "call" : "hop";
    if (phase === "leashMission") return "call";
    if (phase === "leashZoom" || phase === "gate") return "sit";
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

        <section className={`scene bg-${info.bg} ${useEmptyHome ? "called-dogs" : ""} ${needsInput ? "input-open" : ""}`}>
          {phase !== "intro" && phase !== "clear" && phase !== "fail" && <ThreeWalkWorld phase={phase} calledDogs={calledDogs} />}
          <div className="first-person" />
          <SceneFurniture phase={phase} />
          {showDogs && <DogLayer pose={dogPose} phase={phase} rubyCalm={rubyCalm} gamjaQuiet={gamjaQuiet} hearts={hearts || phase === "clear"} peePulse={peePulse} />}
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
          <div className="scene-caption">
            <b>{info.scene}</b>
            <span>{message}</span>
          </div>
          {needsInput && (
            <form className="command" onSubmit={submitCommand}>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={phase === "living" ? "말을 입력해 주세요" : "앉아"}
                autoFocus
              />
              <button type="submit">말하기</button>
            </form>
          )}
        </section>
      </section>

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Jua&family=Nanum+Pen+Script&display=swap");
      `}</style>
      <style jsx>{`
        .walk-page {
          min-height: 100vh;
          padding: 24px;
          background:
            radial-gradient(circle at 16% 4%, rgba(255, 237, 189, 0.82), transparent 18rem),
            radial-gradient(circle at 82% 14%, rgba(184, 222, 255, 0.7), transparent 24rem),
            linear-gradient(135deg, #f9efd7, #d8eef7 55%, #e8f3d2);
          color: #231a15;
          font-family: "Jua", "NanumSquareRound", "Pretendard", "Segoe UI", sans-serif;
          font-size: 1.05rem;
        }

        .back-link {
          color: #60442f;
          font-weight: 900;
          text-decoration: none;
        }

        .game {
          max-width: 1180px;
          margin: 18px auto 0;
          border: 2px solid rgba(72, 50, 35, 0.28);
          border-radius: 24px;
          background: #fffaf1;
          overflow: hidden;
          box-shadow: 0 28px 80px rgba(37, 28, 22, 0.28);
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 18px;
          padding: 20px 22px 16px;
          border-bottom: 1px solid rgba(135, 101, 66, 0.18);
          background: linear-gradient(180deg, #fff7e8, #f2d9ad);
          color: #4b3424;
        }

        .topbar p {
          margin: 0 0 6px;
          color: #8b674c;
          font-size: 1rem;
          font-weight: 900;
        }

        h1 {
          margin: 0;
          font-size: clamp(2.1rem, 4.8vw, 3.6rem);
          letter-spacing: 0;
          color: #3d2b20;
          text-shadow:
            0 3px 0 rgba(255, 255, 255, 0.9),
            0 9px 18px rgba(120, 86, 55, 0.24);
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
          border-top: 1px solid rgba(255,255,255,0.12);
          border-bottom: 1px solid rgba(255,255,255,0.12);
        }

        .scene::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 50% 34%, transparent 0 38%, rgba(255, 255, 255, 0.15) 74%),
            linear-gradient(90deg, rgba(255, 248, 236, 0.16), transparent 32%, rgba(54, 42, 31, 0.08));
          pointer-events: none;
        }

        .bg-home {
          background:
            linear-gradient(90deg, rgba(42,31,22,0.34), rgba(42,31,22,0.04) 48%, rgba(42,31,22,0.18)),
            url("/ruby-gamja/custom/intro-ruby-gamja.jpg") center / cover no-repeat;
        }

        .bg-stairs {
          background:
            linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,248,236,0.2)),
            url("/ruby-gamja/custom/stairs-before.png") center / cover no-repeat;
        }

        .bg-living {
          background:
            radial-gradient(circle at 78% 18%, rgba(255,255,255,0.72), transparent 18rem),
            linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,248,236,0.12)),
            url("/ruby-gamja/custom/home-sleep-dogs.png") center / cover no-repeat;
        }

        .bg-living.called-dogs,
        .bg-entry {
          background:
            radial-gradient(circle at 78% 18%, rgba(255,255,255,0.54), transparent 18rem),
            linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,248,236,0.08)),
            url("/ruby-gamja/custom/home-empty.png") center / cover no-repeat;
        }

        .bg-garden {
          background:
            linear-gradient(180deg, rgba(255,255,255,0.08), rgba(31,45,24,0.08)),
            url("/ruby-gamja/custom/garden-real.png") center / cover no-repeat;
        }

        .bg-gate {
          background:
            linear-gradient(180deg, rgba(255,255,255,0.08), rgba(31,45,24,0.08)),
            url("/ruby-gamja/custom/gate-real.png") center / cover no-repeat;
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
          background: rgba(255, 244, 226, 0.96);
          border: 2px solid rgba(83, 60, 43, 0.2);
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
          background: #fffaf1;
          color: #3f2d20;
        }

        button {
          border: 2px solid rgba(91, 64, 42, 0.24);
          border-radius: 16px;
          padding: 11px 17px;
          background: linear-gradient(180deg, #fff3d7, #dfbf8c);
          color: #4b3322;
          font: inherit;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 6px 0 rgba(91, 64, 42, 0.22), 0 12px 24px rgba(0,0,0,0.16);
          transition: transform 0.14s ease, box-shadow 0.14s ease;
        }

        button::before {
          content: "🐾 ";
          font-size: 0.86em;
        }

        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 0 rgba(91, 64, 42, 0.2), 0 16px 28px rgba(0,0,0,0.18);
        }

        button:active {
          transform: translateY(3px);
          box-shadow: 0 3px 0 rgba(91, 64, 42, 0.24), 0 8px 16px rgba(0,0,0,0.14);
        }

        button:disabled {
          opacity: 0.54;
          cursor: default;
          transform: none;
        }

        .scene-caption {
          position: absolute;
          z-index: 21;
          left: 24px;
          top: 22px;
          max-width: min(430px, calc(100% - 48px));
          display: grid;
          gap: 6px;
          padding: 13px 16px;
          border-radius: 18px;
          background: rgba(255, 250, 241, 0.86);
          border: 1px solid rgba(92, 66, 46, 0.18);
          color: #4b3322;
          box-shadow: 0 14px 36px rgba(42, 28, 18, 0.16);
          backdrop-filter: blur(8px);
        }

        .scene.input-open .scene-caption {
          top: 22px;
        }

        .scene-caption b,
        .scene-caption span {
          line-height: 1.45;
        }

        @media (max-width: 820px) {
          .walk-page {
            padding: 12px;
          }

          .topbar {
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
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255, 238, 210, 0.34);
          background: rgba(255, 244, 226, 0.96);
          color: #4c3425;
          font-weight: 950;
          box-shadow: 0 7px 16px rgba(0,0,0,0.16);
        }
        .pill::before {
          content: "•";
          color: #d79d71;
          font-size: 1.25rem;
          line-height: 0;
        }
        small {
          color: #8c5d3d;
          font-size: 0.78rem;
        }
        .alert {
          background: #ffe5dc;
          color: #a7392d;
        }
      `}</style>
    </span>
  );
}

function ThreeWalkWorld({ phase, calledDogs }: { phase: Phase; calledDogs: boolean }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef({ x: 0, z: 5.5, yaw: 0 });
  const keysRef = useRef(new Set<string>());

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(phase === "garden" || phase === "gate" || phase === "walk" ? "#cfe6c4" : "#f4eadc");
    scene.fog = new THREE.Fog(scene.background, 9, 26);

    const camera = new THREE.PerspectiveCamera(64, width / height, 0.1, 80);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight("#fff6e8", "#59624c", 1.8);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight("#fff1d2", 2.4);
    sun.position.set(-4, 7, 5);
    sun.castShadow = true;
    scene.add(sun);

    const floorMat = new THREE.MeshStandardMaterial({
      color: phase === "garden" || phase === "gate" || phase === "walk" ? "#7faf5f" : "#eee5d8",
      roughness: 0.62,
      metalness: 0.02,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 42), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(34, 18, phase === "garden" || phase === "gate" ? "#8eb170" : "#c8b9a7", "#e2d7ca");
    grid.position.y = 0.012;
    scene.add(grid);

    if (phase === "garden" || phase === "gate" || phase === "walk") {
      addOutdoor(scene);
    } else {
      addInterior(scene);
    }

    const textureLoader = new THREE.TextureLoader();
    const rubyMap = textureLoader.load(dog.ruby.call);
    const gamjaMap = textureLoader.load(dog.gamja.call);
    const ruby = makeDogBillboard(rubyMap, 1.65, 2.25);
    ruby.position.set(-1.1, 1.1, -1.6);
    const gamja = makeDogBillboard(gamjaMap, 1.25, 1.75);
    gamja.position.set(1.15, 0.88, -1.25);
    const dogGroup = new THREE.Group();
    dogGroup.add(ruby, gamja);
    dogGroup.visible = calledDogs || !["living", "upstairs"].includes(phase);
    scene.add(dogGroup);

    const shelf = makeShelf();
    shelf.position.set(4.6, 1.05, -2.6);
    shelf.visible = ["leashPrep", "leashMission", "poopBag"].includes(phase);
    scene.add(shelf);

    const clock = new THREE.Clock();
    let frame = 0;
    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.04);
      const pos = positionRef.current;
      const speed = 3.4 * delta;
      if (keysRef.current.has("ArrowLeft")) pos.yaw += 1.8 * delta;
      if (keysRef.current.has("ArrowRight")) pos.yaw -= 1.8 * delta;
      const forward = new THREE.Vector3(Math.sin(pos.yaw), 0, -Math.cos(pos.yaw));
      if (keysRef.current.has("ArrowUp")) {
        pos.x += forward.x * speed;
        pos.z += forward.z * speed;
      }
      if (keysRef.current.has("ArrowDown")) {
        pos.x -= forward.x * speed;
        pos.z -= forward.z * speed;
      }
      pos.x = THREE.MathUtils.clamp(pos.x, -6.2, 6.2);
      pos.z = THREE.MathUtils.clamp(pos.z, -10.5, 8.5);

      camera.position.set(pos.x, 1.55, pos.z);
      camera.rotation.set(0, pos.yaw, 0);
      dogGroup.children.forEach((child) => child.lookAt(camera.position));
      dogGroup.position.y = ["excited", "leashPrep"].includes(phase) ? Math.sin(clock.elapsedTime * 8) * 0.06 : 0;
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
        keysRef.current.add(event.code);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.code);
    };
    const onResize = () => {
      const nextWidth = Math.max(1, mount.clientWidth);
      const nextHeight = Math.max(1, mount.clientHeight);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", onResize);
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      rubyMap.dispose();
      gamjaMap.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [calledDogs, phase]);

  return (
    <div className="three-world" ref={mountRef} aria-label="3D 산책 공간">
      <div className="move-help">방향키 ↑ 앞으로 · ↓ 뒤로 · ←/→ 방향 전환</div>
      <style jsx>{`
        .three-world {
          position: absolute;
          z-index: 1;
          inset: 0;
          overflow: hidden;
          background: #f4eadc;
        }
        .three-world :global(canvas) {
          display: block;
          width: 100%;
          height: 100%;
        }
        .move-help {
          position: absolute;
          right: 18px;
          bottom: 18px;
          z-index: 2;
          padding: 9px 13px;
          border-radius: 999px;
          background: rgba(255, 250, 242, 0.78);
          color: #4c3828;
          font-size: 0.92rem;
          font-weight: 950;
          box-shadow: 0 12px 28px rgba(35, 25, 18, 0.16);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

function makeDogBillboard(map: THREE.Texture, width: number, height: number) {
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.y = height / 2;
  return mesh;
}

function addInterior(scene: THREE.Scene) {
  const wallMat = new THREE.MeshStandardMaterial({ color: "#f2e5d5", roughness: 0.75 });
  const woodMat = new THREE.MeshStandardMaterial({ color: "#7a4a2f", roughness: 0.58 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 0.18), wallMat);
  backWall.position.set(0, 2, -8);
  scene.add(backWall);
  const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4, 16), wallMat);
  sideWall.position.set(-7, 2, 0);
  scene.add(sideWall);
  for (let i = 0; i < 7; i += 1) {
    const stair = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.18, 0.65), woodMat);
    stair.position.set(-3.6, 0.12 + i * 0.15, -5.6 - i * 0.48);
    stair.castShadow = true;
    stair.receiveShadow = true;
    scene.add(stair);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.8, 0.16), new THREE.MeshStandardMaterial({ color: "#dfd5c8", roughness: 0.45 }));
  door.position.set(5.6, 1.4, -7.88);
  scene.add(door);
  const plant = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 8), new THREE.MeshStandardMaterial({ color: "#5f8c52", roughness: 0.9 }));
  plant.position.set(5.7, 0.7, -4.1);
  scene.add(plant);
}

function addOutdoor(scene: THREE.Scene) {
  const pathMat = new THREE.MeshStandardMaterial({ color: "#cfc6b5", roughness: 0.82 });
  for (let i = 0; i < 8; i += 1) {
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 18), pathMat);
    stone.rotation.y = i * 0.34;
    stone.position.set(Math.sin(i * 0.6) * 0.8, 0.04, 3.8 - i * 1.45);
    stone.receiveShadow = true;
    scene.add(stone);
  }
  const gateMat = new THREE.MeshStandardMaterial({ color: "#1f2321", roughness: 0.45, metalness: 0.15 });
  for (let i = -3; i <= 3; i += 1) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 0.08), gateMat);
    bar.position.set(i * 0.38, 1.15, -7.2);
    scene.add(bar);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.08, 0.08), gateMat);
  rail.position.set(0, 1.55, -7.2);
  scene.add(rail);
  const bushMat = new THREE.MeshStandardMaterial({ color: "#4f7c3e", roughness: 0.9 });
  [-4.6, 4.6].forEach((x) => {
    const bush = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 10), bushMat);
    bush.position.set(x, 0.8, -4.5);
    scene.add(bush);
  });
}

function makeShelf() {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#8a5b39", roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 0.75), wood);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  [0.48, -0.48].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), wood);
    leg.position.set(x, -0.62, 0.24);
    group.add(leg);
  });
  const rubyLeash = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 28), new THREE.MeshStandardMaterial({ color: "#d16b82", roughness: 0.38 }));
  rubyLeash.position.set(-0.44, 0.18, 0.08);
  group.add(rubyLeash);
  const gamjaLeash = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 28), new THREE.MeshStandardMaterial({ color: "#5d89c7", roughness: 0.38 }));
  gamjaLeash.position.set(0.1, 0.18, 0.08);
  group.add(gamjaLeash);
  const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.28, 8, 16), new THREE.MeshStandardMaterial({ color: "#5d7d55", roughness: 0.35 }));
  bag.position.set(0.62, 0.18, 0.08);
  group.add(bag);
  return group;
}

function DogLayer({
  pose,
  phase,
  rubyCalm,
  gamjaQuiet,
  hearts,
  peePulse,
}: {
  pose: string;
  phase: Phase;
  rubyCalm: boolean;
  gamjaQuiet: boolean;
  hearts: boolean;
  peePulse: boolean;
}) {
  const rubySrc = dog.ruby[pose as keyof typeof dog.ruby] || dog.ruby.walk;
  const gamjaSrc = dog.gamja[pose as keyof typeof dog.gamja] || dog.gamja.walk;
  const rubySpinning = phase === "gate" && !rubyCalm;
  return (
    <div className={`dogs dogs-${pose} phase-${phase} ${rubySpinning ? "dogs-spin" : ""}`}>
      <DogSprite src={rubySrc} name="루비" side="left" hearts={hearts} spinning={rubySpinning} />
      <DogSprite src={peePulse ? dog.gamja.pee : gamjaSrc} name="감자" side="right" hearts={hearts} />
      {phase === "gate" && !gamjaQuiet && <div className="bark-bubble">멍! 멍!</div>}
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
        .dogs-sleep :global(.sprite) {
          width: clamp(250px, 40vw, 460px);
          height: clamp(150px, 23vw, 240px);
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
        .bark-bubble {
          position: absolute;
          right: 13%;
          top: 20px;
          padding: 10px 14px;
          border-radius: 18px;
          background: #fff6e4;
          color: #4b3322;
          font-weight: 950;
          box-shadow: 0 10px 22px rgba(0,0,0,0.18);
          animation: barkPop 0.42s ease-in-out infinite alternate;
        }
        .bark-bubble::after {
          content: "";
          position: absolute;
          right: 24px;
          bottom: -9px;
          border: 10px solid transparent;
          border-top-color: #fff6e4;
          border-bottom: 0;
        }
        @keyframes hop {
          to { transform: translateX(-50%) translateY(-18px); }
        }
        @keyframes run {
          to { transform: translateX(-50%) translateY(-8px) scale(1.02); }
        }
        @keyframes barkPop {
          to { transform: translateY(-5px) scale(1.04); }
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
        .sprite.right {
          width: clamp(272px, 39.1vw, 425px);
          height: clamp(323px, 51vw, 544px);
        }
        .phase-living .sprite.right {
          width: clamp(160px, 23vw, 250px);
          height: clamp(190px, 30vw, 320px);
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
        .shoe-cabinet::after {
          content: "";
          position: absolute;
          left: 30px;
          top: 20px;
          width: 58px;
          height: 38px;
          border: 7px solid #c46e7e;
          border-radius: 50%;
          box-shadow:
            78px 2px 0 -2px #f7efe5,
            78px 2px 0 4px #5d89c7,
            170px 0 0 5px #78c766,
            0 70px 0 -8px rgba(68, 47, 35, 0.36),
            86px 70px 0 -8px rgba(68, 47, 35, 0.28),
            178px 70px 0 -8px rgba(68, 47, 35, 0.22);
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
          background:
            repeating-linear-gradient(90deg, rgba(22, 24, 22, 0.82) 0 12px, transparent 12px 50px),
            linear-gradient(90deg, transparent 48%, rgba(22, 24, 22, 0.92) 48% 52%, transparent 52%),
            rgba(255,255,255,0.08);
          box-shadow: 0 18px 36px rgba(35, 48, 29, 0.26);
          transform: translateX(-50%);
        }
        .garden-path {
          position: absolute;
          left: 50%;
          bottom: -52px;
          width: min(560px, 82vw);
          height: 380px;
          border-radius: 44% 44% 0 0;
          background:
            repeating-linear-gradient(18deg, rgba(255,255,255,0.18) 0 2px, transparent 2px 56px),
            linear-gradient(180deg, #d7c7ad, #a99275);
          box-shadow: 0 -20px 50px rgba(49, 76, 40, 0.18);
          transform: translateX(-50%) perspective(420px) rotateX(58deg);
        }
        .flower-bed {
          position: absolute;
          left: 5%;
          right: 5%;
          bottom: 120px;
          height: 120px;
          background:
            radial-gradient(circle at 12% 60%, #f08ca0 0 8px, transparent 9px),
            radial-gradient(circle at 18% 35%, #f4c15c 0 7px, transparent 8px),
            radial-gradient(circle at 82% 42%, #f08ca0 0 8px, transparent 9px),
            radial-gradient(circle at 88% 70%, #fff1a3 0 7px, transparent 8px),
            linear-gradient(180deg, transparent 0 40%, rgba(54, 105, 45, 0.55) 40% 100%);
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
    return <CenterCard title={"루비&감자\n산책시키기"} button="산책 START" onClick={p.start} image={dog.intro} variant="intro" />;
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
    return (
      <>
        <GearShelf rubyLeashed={p.rubyLeashed} gamjaLeashed={p.gamjaLeashed} hasPoopBag={p.hasPoopBag} side />
        <ActionDock>
        <button onClick={p.sitDogs}>앉아</button>
        <button onClick={p.startLeash}>목줄 채우기</button>
        </ActionDock>
      </>
    );
  }
  if (p.phase === "leashMission") {
    return (
      <>
        <GearShelf rubyLeashed={p.rubyLeashed} gamjaLeashed={p.gamjaLeashed} hasPoopBag={p.hasPoopBag} side />
        <LeashTargets rubyLeashed={p.rubyLeashed} gamjaLeashed={p.gamjaLeashed} finish={p.finishLeash} />
      </>
    );
  }
  if (p.phase === "leashZoom" && p.zoomDog) {
    return <LeashZoom dogKey={p.zoomDog} finish={p.finishLeash} />;
  }
  if (p.phase === "poopBag") {
    return <PoopBagDock hasPoopBag={p.hasPoopBag} setHasPoopBag={p.setHasPoopBag} setMessage={p.setMessage} goOut={p.goOut} />;
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
          루감이
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
            const dragged = event.dataTransfer.getData("text/plain");
            if (dragged && dragged !== `${dogKey}-leash`) return;
            finish(dogKey);
          }}
        >
          고리
        </div>
      </div>
      <div className="zoom-shelf">
        {(["ruby", "gamja"] as Dog[]).map((target) => (
          <div
            key={target}
            draggable
            className={`leash ${target} ${target === dogKey ? "active" : ""}`}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", `${target}-leash`);
              event.dataTransfer.effectAllowed = "move";
              playSound("leash");
            }}
          >
            <span />
            {target === "ruby" ? "루비 목줄" : "감자 목줄"}
          </div>
        ))}
        <div className="bag-mini"><span />똥봉투</div>
      </div>
      <style jsx>{`
        .zoom {
          position: absolute;
          z-index: 30;
          inset: 70px 6% 92px;
          display: grid;
          grid-template-columns: minmax(260px, 520px) minmax(190px, 230px);
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
        .collar::after {
          content: "";
          position: absolute;
          inset: -18px;
          border-radius: inherit;
        }
        .zoom-shelf {
          display: grid;
          gap: 12px;
          padding: 16px;
          border-radius: 22px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.9), rgba(242,226,205,0.94)),
            repeating-linear-gradient(90deg, rgba(110,75,52,0.09) 0 1px, transparent 1px 38px);
          border: 1px solid rgba(116, 84, 60, 0.22);
          box-shadow: 0 22px 45px rgba(0,0,0,0.22), inset 0 -8px 0 rgba(118, 78, 48, 0.12);
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
        .leash.active {
          outline: 3px solid rgba(89, 142, 217, 0.35);
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
        .leash.gamja span {
          border-color: #5d89c7;
        }
        .bag-mini {
          display: grid;
          place-items: center;
          gap: 6px;
          min-height: 74px;
          border-radius: 18px;
          background: rgba(255, 250, 242, 0.7);
          font-weight: 950;
          color: #4b3024;
        }
        .bag-mini span {
          width: 36px;
          height: 42px;
          border-radius: 8px 8px 14px 14px;
          background: linear-gradient(180deg, #9bdc72, #55a848);
          box-shadow: inset 0 8px 0 rgba(255,255,255,0.26), 0 8px 14px rgba(69, 116, 54, 0.25);
        }
      `}</style>
    </div>
  );
}

function LeashTargets({ rubyLeashed, gamjaLeashed, finish }: { rubyLeashed: boolean; gamjaLeashed: boolean; finish: (dog: Dog) => void }) {
  const makeDrop = (target: Dog) => (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const dragged = event.dataTransfer.getData("text/plain");
    if (dragged !== `${target}-leash`) return;
    finish(target);
  };

  return (
    <div className="leash-targets">
      <div
        className={`dog-target ruby ${rubyLeashed ? "done" : ""}`}
        onDragEnter={(event) => event.currentTarget.classList.add("over")}
        onDragLeave={(event) => event.currentTarget.classList.remove("over")}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={makeDrop("ruby")}
      >
        <Image src={dog.ruby.call} alt="루비" fill sizes="210px" />
        <span>{rubyLeashed ? "루비 목줄 착용!" : "루비"}</span>
      </div>
      <div
        className={`dog-target gamja ${gamjaLeashed ? "done" : ""}`}
        onDragEnter={(event) => event.currentTarget.classList.add("over")}
        onDragLeave={(event) => event.currentTarget.classList.remove("over")}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={makeDrop("gamja")}
      >
        <Image src={dog.gamja.call} alt="감자" fill sizes="150px" />
        <span>{gamjaLeashed ? "감자 목줄 착용!" : "감자"}</span>
      </div>
      <style jsx>{`
        .leash-targets {
          position: absolute;
          z-index: 24;
          inset: 0;
          pointer-events: none;
        }
        .dog-target {
          position: absolute;
          bottom: 66px;
          width: 260px;
          height: 330px;
          border-radius: 42px;
          background: rgba(255, 250, 242, 0.12);
          border: 3px dashed rgba(255, 230, 175, 0.84);
          box-shadow: 0 18px 38px rgba(66, 45, 30, 0.16);
          overflow: hidden;
          pointer-events: auto;
          transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
        }
        .dog-target.ruby { left: 18%; }
        .dog-target.gamja {
          left: 43%;
          width: 260px;
          height: 330px;
        }
        .dog-target.over {
          transform: translateY(-6px) scale(1.03);
          border-color: #8bd36c;
          background: rgba(240, 255, 230, 0.36);
        }
        .dog-target.done {
          border-style: solid;
          border-color: #6abd50;
          background: rgba(225, 245, 210, 0.34);
        }
        .dog-target :global(img) {
          object-fit: contain;
          padding: 10px 12px 22px;
          filter: drop-shadow(0 8px 10px rgba(0,0,0,0.22));
        }
        span {
          position: absolute;
          left: 50%;
          bottom: 7px;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(255, 247, 232, 0.92);
          color: #4b3322;
          font-weight: 950;
          transform: translateX(-50%);
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
        <span className="poop-pile" />
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
            {tool === "bag" ? "똥봉투" : tool === "leaf" ? "나뭇잎" : "양말"}
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
        .poop-target {
          display: grid;
          place-items: center;
          gap: 4px;
          min-width: 104px;
        }
        .poop-pile {
          width: 42px;
          height: 34px;
          border-radius: 50% 50% 46% 46%;
          background:
            radial-gradient(circle at 50% 16%, #7a4a24 0 9px, transparent 10px),
            radial-gradient(circle at 34% 56%, #6a3b1d 0 14px, transparent 15px),
            radial-gradient(circle at 62% 60%, #8a562b 0 15px, transparent 16px);
          filter: drop-shadow(0 5px 5px rgba(0,0,0,0.18));
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

function GearShelf({
  rubyLeashed,
  gamjaLeashed,
  hasPoopBag,
  side = false,
}: {
  rubyLeashed: boolean;
  gamjaLeashed: boolean;
  hasPoopBag: boolean;
  side?: boolean;
}) {
  const startLeashDrag = (event: ReactDragEvent<HTMLDivElement>, target: Dog) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${target}-leash`);
    playSound("leash");
  };

  const startPoopBagDrag = (event: ReactDragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", "poop-bag");
  };

  return (
    <div className={`gear-shelf ${side ? "side" : ""}`} aria-label="현관 선반">
      <div className="shelf-title">현관 선반</div>
      <div
        draggable={!rubyLeashed}
        className={`gear-leash ruby ${rubyLeashed ? "used" : ""}`}
        onDragStart={(event) => startLeashDrag(event, "ruby")}
      >
        <span className="loop" />
        <span className="strap" />
        <small>루비 목줄</small>
      </div>
      <div
        draggable={!gamjaLeashed}
        className={`gear-leash gamja ${gamjaLeashed ? "used" : ""}`}
        onDragStart={(event) => startLeashDrag(event, "gamja")}
      >
        <span className="loop" />
        <span className="strap" />
        <small>감자 목줄</small>
      </div>
      <div
        draggable={!hasPoopBag}
        className={`poop-bag-icon ${hasPoopBag ? "used" : ""}`}
        onDragStart={startPoopBagDrag}
      >
        <Image src="/ruby-gamja/custom/poop-bag-real.png" alt="똥봉투" fill sizes="90px" />
        <small>똥봉투</small>
      </div>
      <style jsx>{`
        .gear-shelf {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          width: min(520px, 100%);
          padding: 14px;
          border-radius: 18px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.86), rgba(244,232,215,0.92)),
            repeating-linear-gradient(90deg, rgba(120,82,52,0.08) 0 1px, transparent 1px 38px);
          border: 1px solid rgba(111, 78, 55, 0.24);
          box-shadow: inset 0 -8px 0 rgba(109, 73, 48, 0.12), 0 16px 30px rgba(84, 58, 42, 0.16);
        }
        .gear-shelf.side {
          position: absolute;
          z-index: 25;
          top: 86px;
          right: 24px;
          width: min(260px, calc(100% - 48px));
          grid-template-columns: 1fr;
        }
        .shelf-title {
          grid-column: 1 / -1;
          font-size: 0.9rem;
          font-weight: 950;
          color: #5f4535;
        }
        .gear-leash,
        .poop-bag-icon {
          position: relative;
          display: grid;
          place-items: center;
          min-height: 78px;
          border-radius: 16px;
          background: rgba(255, 250, 242, 0.72);
          border: 1px solid rgba(107, 74, 52, 0.15);
          box-shadow: 0 10px 18px rgba(82, 57, 40, 0.12);
          color: #4c3828;
          font-weight: 950;
          cursor: grab;
          user-select: none;
          overflow: hidden;
        }
        .gear-leash.used,
        .poop-bag-icon.used {
          opacity: 0.45;
          cursor: default;
        }
        .loop {
          width: 52px;
          height: 34px;
          border: 6px solid #d16b82;
          border-radius: 50%;
          box-shadow: 0 0 0 4px rgba(255,255,255,0.7) inset;
        }
        .gamja .loop {
          border-color: #5d89c7;
        }
        .strap {
          position: absolute;
          top: 33px;
          width: 72px;
          height: 10px;
          border-radius: 999px;
          background: linear-gradient(90deg, #7c4f37, #f2bfd0, #7c4f37);
          transform: rotate(-17deg);
        }
        .gamja .strap {
          background: linear-gradient(90deg, #2c4d74, #9bc7ff, #2c4d74);
        }
        .poop-bag-icon :global(img) {
          object-fit: contain;
          padding: 6px 18px 20px;
          filter: drop-shadow(0 10px 14px rgba(42, 66, 42, 0.2));
        }
        .poop-bag-icon small {
          position: absolute;
          left: 50%;
          bottom: 7px;
          transform: translateX(-50%);
          padding: 2px 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.8);
        }
        small {
          font-size: 0.78rem;
        }
      `}</style>
    </div>
  );
}

function PoopBagDock({
  hasPoopBag,
  setHasPoopBag,
  setMessage,
  goOut,
}: {
  hasPoopBag: boolean;
  setHasPoopBag: (value: boolean) => void;
  setMessage: (message: string) => void;
  goOut: () => void;
}) {
  const collectBag = () => {
    setHasPoopBag(true);
    playSound("success");
    setMessage("똥봉투를 챙겼어요.");
  };

  return (
    <>
      <GearShelf rubyLeashed gamjaLeashed hasPoopBag={hasPoopBag} side />
      <ActionDock>
      <div
        className={hasPoopBag ? "drop-zone bag-drop done" : "drop-zone bag-drop"}
        onDragOver={(event) => event.preventDefault()}
        onDrop={collectBag}
      >
        <span />
        산책 가방
      </div>
      <div
        draggable={!hasPoopBag}
        className={`drag-chip poop-bag-drag ${hasPoopBag ? "done" : ""}`}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", "poop-bag");
        }}
      >
        <Image src="/ruby-gamja/custom/poop-bag-real.png" alt="똥봉투" fill sizes="96px" />
      </div>
      <button onClick={collectBag}>똥봉투 챙기기</button>
      <button onClick={goOut}>나가기</button>
      </ActionDock>
      <style jsx>{`
        .bag-drop {
          display: grid;
          place-items: center;
          min-width: 120px;
          min-height: 82px;
        }
        .bag-drop span {
          position: relative;
          width: 54px;
          height: 42px;
          border-radius: 12px 12px 18px 18px;
          background: linear-gradient(180deg, #8a6b48, #4f3826);
          box-shadow: inset 0 8px 0 rgba(255,255,255,0.18), 0 8px 14px rgba(0,0,0,0.18);
        }
        .bag-drop span::before {
          content: "";
          position: absolute;
          left: 15px;
          top: -12px;
          width: 24px;
          height: 18px;
          border: 5px solid #6d5135;
          border-bottom: 0;
          border-radius: 18px 18px 0 0;
        }
        .poop-bag-drag {
          position: relative;
          width: 92px;
          height: 82px;
          overflow: hidden;
          background: linear-gradient(180deg, #e7f9d5, #a6df83);
          color: #326129;
        }
        .poop-bag-drag :global(img) {
          object-fit: contain;
          padding: 4px;
          filter: drop-shadow(0 8px 12px rgba(45,75,45,0.24));
        }
        .poop-bag-drag.done {
          opacity: 0.45;
        }
      `}</style>
    </>
  );
}

function ActionDock({ children }: { children: ReactNode }) {
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

function CenterCard({
  title,
  body,
  button,
  onClick,
  image,
  variant = "",
}: {
  title: string;
  body?: string;
  button: string;
  onClick: () => void;
  image: string;
  variant?: "intro" | "";
}) {
  return (
    <div className={`center-card ${variant}`}>
      <div className="hero-dogs"><Image src={image} alt="루비와 감자" fill sizes="520px" priority /></div>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      <button onClick={onClick}>{button}</button>
      <style jsx>{`
        .center-card {
          position: absolute;
          z-index: 30;
          left: 50%;
          top: 50%;
          width: min(560px, calc(100% - 32px));
          min-height: 430px;
          padding: 250px 28px 34px;
          border-radius: 30px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(32, 24, 18, 0.34)),
            rgba(255,250,242,0.9);
          text-align: center;
          box-shadow: 0 28px 72px rgba(0,0,0,0.3);
          transform: translate(-50%, -50%);
          overflow: hidden;
          color: #fff9ef;
        }
        .center-card.intro {
          background:
            linear-gradient(90deg, rgba(26, 18, 13, 0.5), rgba(26, 18, 13, 0.08) 58%, rgba(26, 18, 13, 0.38));
          color: #fff8ec;
          padding-top: 280px;
        }
        .hero-dogs {
          position: absolute;
          inset: 0 0 auto;
          height: 100%;
          margin: 0;
          filter: none;
          z-index: -1;
        }
        .hero-dogs::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 18% 18%, rgba(255, 213, 220, 0.28), transparent 8rem),
            linear-gradient(90deg, rgba(18, 13, 10, 0.66), rgba(18, 13, 10, 0.1) 50%, rgba(18, 13, 10, 0.38));
        }
        .hero-dogs :global(img) { object-fit: cover; }
        .intro .hero-dogs {
          inset: 0;
          height: 100%;
          z-index: -1;
          filter: none;
        }
        .intro .hero-dogs::after {
          display: block;
        }
        .intro .hero-dogs :global(img) {
          object-fit: cover;
        }
        h2 {
          position: relative;
          z-index: 1;
          margin: 0 0 10px;
          font-size: clamp(2.4rem, 7vw, 5rem);
          line-height: 0.92;
          white-space: pre-line;
          color: #fff6e8;
          text-shadow:
            0 5px 0 rgba(62, 42, 28, 0.92),
            0 13px 24px rgba(0,0,0,0.45);
        }
        h2::after {
          content: " ♥";
          color: #f3a3ae;
          font-size: 0.46em;
          vertical-align: top;
        }
        p {
          position: relative;
          z-index: 1;
          margin: 0 0 18px;
          color: #fff3df;
          font-weight: 850;
          line-height: 1.6;
          text-shadow: 0 2px 6px rgba(0,0,0,0.4);
        }
        button {
          position: relative;
          z-index: 1;
          background: linear-gradient(180deg, #fff3d7, #dfbf8c);
          color: #4b3322;
          border: 2px solid rgba(255, 255, 255, 0.35);
          min-width: 240px;
          padding: 18px 26px;
          border-radius: 22px;
          font-size: clamp(1.25rem, 3vw, 1.8rem);
        }
      `}</style>
    </div>
  );
}
