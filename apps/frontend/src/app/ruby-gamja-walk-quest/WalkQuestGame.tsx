"use client";

import Image from "next/image";
import Link from "next/link";
import { type DragEvent as ReactDragEvent, FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  | "cat"
  | "catFood"
  | "home"
  | "enterHome"
  | "clear"
  | "fail";

type Dog = "ruby" | "gamja";
type Lane = "left" | "center" | "right";
type PoopTool = "bag" | "leaf" | "sock" | null;
type PoopStep = "ask" | "bagCheck" | "leafAsk" | "leafReady" | "sockAsk" | "sockReady";

const movementKeyCodes = ["KeyW", "KeyA", "KeyS", "KeyD"];

function randomLane(): Lane {
  const lanes: Lane[] = ["left", "center", "right"];
  return lanes[Math.floor(Math.random() * lanes.length)];
}

// Replace only these paths when swapping Ruby/Gamja cutout assets later.
const dog = {
  ruby: {
    call: "/ruby-gamja/custom/ruby-come.png",
    hop: "/ruby-gamja/custom/ruby-hop-new.png",
    stairs: "/ruby-gamja/custom/ruby-lie-stairs.png",
    sleep: "/ruby-gamja/custom/ruby-lie-stairs.png",
    sit: "/ruby-gamja/custom/ruby-gate-sit.png",
    gateSit: "/ruby-gamja/custom/ruby-gate-sit.png",
    walk: "/ruby-gamja/custom/ruby-back-walk.png",
    back: "/ruby-gamja/custom/ruby-back-walk.png",
    alert: "/ruby-gamja/custom/ruby-gate-sit.png",
    run: "/ruby-gamja/custom/ruby-back-walk.png",
    heart: "/ruby-gamja/custom/ruby-come.png",
  },
  gamja: {
    call: "/ruby-gamja/custom/gamja-come.png",
    hop: "/ruby-gamja/custom/gamja-hop-new.png",
    stairs: "/ruby-gamja/custom/gamja-lie-stairs.png",
    sleep: "/ruby-gamja/custom/gamja-lie-stairs.png",
    sit: "/ruby-gamja/custom/gamja-gate-quiet.png",
    gateQuiet: "/ruby-gamja/custom/gamja-gate-quiet.png",
    walk: "/ruby-gamja/custom/gamja-back-walk.png",
    back: "/ruby-gamja/custom/gamja-back-walk.png",
    alert: "/ruby-gamja/custom/gamja-gate-quiet.png",
    run: "/ruby-gamja/custom/gamja-back-walk.png",
    pee: "/ruby-gamja/cutouts-v3/gamja-pee.png",
    poop: "/ruby-gamja/cutouts-v3/gamja-poop.png",
    heart: "/ruby-gamja/custom/gamja-come.png",
  },
  intro: "/ruby-gamja/custom/opening-ruby-gamja.jpg",
  duo: "/ruby-gamja/custom/intro-ruby-gamja.jpg",
};

const animal = {
  neighborDog: "/ruby-gamja/custom/neighbor-bark-dog.png",
  neighborBarkAudio: "/ruby-gamja/custom/neighbor-chihuahua-bark.mp3",
  bossDog: "/ruby-gamja/custom/boss-dog.png",
  bossDogAudio: "/ruby-gamja/custom/boss-dog-bark.mp3",
  cat: "/ruby-gamja/custom/cat.png",
  catAudio: "/ruby-gamja/custom/cat-meow.mp3",
  gamjaGateBarkAudio: "/ruby-gamja/custom/gamja-gate-bark.mp3",
  walkingStepsAudio: "/ruby-gamja/custom/walking-steps.mp3",
};

type SoundName = "bark" | "happy" | "leash" | "success" | "fall" | "car" | "poop" | "step" | "click";

function playSound(name: SoundName) {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const ctx = new AudioContextClass();
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(name === "car" ? 0.18 : name === "click" ? 0.045 : 0.08, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (name === "click" ? 0.16 : 0.42));

  const playTone = (frequency: number, start: number, duration: number, type: OscillatorType = "sine") => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now + start);
    osc.connect(gain);
    osc.start(now + start);
    osc.stop(now + start + duration);
  };

  if (name === "click") {
    playTone(620, 0, 0.045, "triangle");
    playTone(420, 0.035, 0.055, "sine");
  } else if (name === "bark") {
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

  window.setTimeout(() => void ctx.close(), name === "click" ? 220 : 520);
}

const callWords = ["\uB8E8\uBE44", "\uAC10\uC790", "\uB8E8\uAC10"];
const walkWords = ["\uC0B0\uCC45", "\uB098\uAC00\uC790", "\uB098\uAC08\uAE4C"];

const phaseInfo: Record<Phase, { scene: string; mission: string; bg: string }> = {
  intro: { scene: "\uC624\uD504\uB2DD", mission: "\uC0B0\uCC45 START \uBC84\uD2BC\uC744 \uB20C\uB7EC \uC2DC\uC791\uD558\uC138\uC694.", bg: "home" },
  upstairs: { scene: "2\uCE35 \uACC4\uB2E8", mission: "1\uCE35\uC73C\uB85C \uB0B4\uB824\uAC00 \uBCFC\uAE4C\uC694? W\uB97C \uB20C\uB7EC \uACC4\uB2E8\uC744 \uB0B4\uB824\uAC00\uC138\uC694.", bg: "stairs" },
  living: { scene: "1\uCE35 \uAC70\uC2E4", mission: "\uB8E8\uBE44, \uAC10\uC790, \uB8E8\uAC10\uC774\uB97C \uBD88\uB7EC\uBCF4\uC138\uC694.", bg: "living" },
  excited: { scene: "\uD604\uAD00 \uC774\uB3D9", mission: "\uAC15\uC544\uC9C0\uB4E4\uC774 \uC2E0\uB098\uAC8C \uCF69\uCF69 \uB6F0\uC5B4\uC694. \uD604\uAD00 \uCABD\uC73C\uB85C \uAC00\uBCFC\uAE4C\uC694?", bg: "living" },
  leashPrep: { scene: "\uD604\uAD00", mission: "\uD604\uAD00\uC5D0 \uB3C4\uCC29\uD588\uC5B4\uC694. \uC0B0\uCC45\uC774\uB77C\uB294 \uB9D0\uC5D0 \uD765\uBD84\uD55C \uAC15\uC544\uC9C0\uB4E4\uC744 \uC549\uD600\uBCFC\uAE4C\uC694?", bg: "entry" },
  leashMission: { scene: "\uBAA9\uC904 \uBBF8\uC158", mission: "5\uCD08 \uC548\uC5D0 \uBAA9\uC904\uC744 \uAC15\uC544\uC9C0\uC5D0\uAC8C \uB4DC\uB798\uADF8\uD574\uC11C \uCC44\uC6CC\uC8FC\uC138\uC694.", bg: "entry" },
  leashZoom: { scene: "\uBAA9\uC904 \uCC44\uC6B0\uAE30", mission: "\uBAA9\uC904\uC744 \uCC44\uC6CC\uC8FC\uC138\uC694.", bg: "entry" },
  poopBag: { scene: "\uCD9C\uBC1C \uC900\uBE44", mission: "\uBAA9\uC904 \uCC29\uC6A9 \uC644\uB8CC! \uC78A\uC740 \uBB3C\uAC74\uC774 \uC788\uC9C0 \uC54A\uC740\uC9C0 \uD655\uC778\uD558\uACE0 \uB098\uAC00\uC138\uC694.", bg: "entry" },
  garden: { scene: "\uC815\uC6D0", mission: "\uC815\uC6D0\uC73C\uB85C \uB098\uC654\uC5B4\uC694. \uB300\uBB38 \uBC16\uC73C\uB85C \uB098\uAC00 \uBCF8\uACA9\uC801\uC778 \uC0B0\uCC45 \uD574\uBCFC\uAE4C\uC694?", bg: "garden" },
  gate: { scene: "\uB300\uBB38 \uC55E", mission: "\uB8E8\uBE44\uB294 \uBE59\uAE00\uBE59\uAE00 \uB3CC\uACE0, \uAC10\uC790\uB294 \uC2E0\uB098\uC11C \uC9D6\uACE0 \uC788\uC5B4\uC694.", bg: "gate" },
  walk: { scene: "\uC0B0\uCC45\uAE38", mission: "\uB298 \uAC00\uB358 \uC0B0\uCC45\uAE38\uC774\uC5D0\uC694. \uC55E\uC73C\uB85C \uAC00\uBCFC\uAE4C\uC694?", bg: "street" },
  pull: { scene: "\uC904 \uB2F9\uAE40", mission: "\uB8E8\uBE44\uAC00 \uC904\uC744 \uB2F9\uACA8\uC694. 7\uCD08 \uC548\uC5D0 \uCC9C\uCC9C\uD788\uB77C\uACE0 \uC785\uB825\uD558\uC138\uC694.", bg: "street" },
  poop: { scene: "\uD3AB\uD2F0\uCF13", mission: "주의! 감자가 똥을 쌌어요. 펫티켓을 지키겠습니까?", bg: "street" },
  run: { scene: "\uB6F0\uAE30", mission: "\uB0A0\uC528\uAC00 \uC88B\uB124\uC694. \uC2A4\uD398\uC774\uC2A4\uBC14\uB97C \uBE60\uB974\uAC8C \uB20C\uB7EC \uB530\uB77C\uAC00\uC138\uC694.", bg: "street" },
  car: { scene: "\uCC28 \uC870\uC2EC", mission: "\uC18D\uB3C4\uB97C \uB530\uB77C\uC7A1\uC558\uC5B4\uC694! \uADF8\uB7F0\uB370 \uC55E\uC5D0 \uCC28\uAC00 \uC624\uB124\uC694. \uC5BC\uB978 \uD53C\uD574\uC8FC\uC138\uC694!", bg: "road" },
  barkingDog: { scene: "\uC606\uC9D1 \uAC15\uC544\uC9C0", mission: "\uC606\uC9D1 \uAC15\uC544\uC9C0\uAC00 \uC9D6\uACE0 \uC788\uC5B4\uC694. 5\uCD08 \uC548\uC5D0 \uBB34\uC2DC\uD574\uB77C\uACE0 \uC785\uB825\uD558\uC138\uC694.", bg: "fence" },
  boss: { scene: "\uC0AC\uB098\uC6B4 \uAC15\uC544\uC9C0", mission: "\uC0AC\uB098\uC6B4 \uAC15\uC544\uC9C0\uAC00 \uB2EC\uB824\uC640\uC694. \uB098\uD0C0\uB098\uBA74 3\uCD08 \uC548\uC5D0 \uD074\uB9AD\uD558\uC138\uC694.", bg: "fence" },
  cat: { scene: "\uACE0\uC591\uC774 \uB4F1\uC7A5", mission: "\uACE0\uC591\uC774\uAC00 \uC67C\uCABD\uC5D0 \uB098\uD0C0\uB0AC\uC5B4\uC694. 5\uCD08 \uC548\uC5D0 \uC548\uB3FC\uB77C\uACE0 \uC785\uB825\uD558\uC138\uC694.", bg: "street" },
  catFood: { scene: "길고양이 밥", mission: "왼쪽에 길고양이 밥이 있어요. 루비가 달려들기 전에 3초 안에 먹지마를 입력하세요.", bg: "street" },
  home: { scene: "\uC9D1 \uC55E", mission: "\uC9D1\uC5D0 \uAC70\uC758 \uB3C4\uCC29\uD588\uC5B4\uC694. \uD604\uAD00\uBB38\uC73C\uB85C \uB4E4\uC5B4\uAC00\uBCFC\uAE4C\uC694?", bg: "gate" },
  enterHome: { scene: "\uADC0\uAC00", mission: "\uD604\uAD00\uBB38\uC774 \uC5F4\uB9AC\uACE0 \uB8E8\uBE44\uC640 \uAC10\uC790\uAC00 \uC9D1\uC73C\uB85C \uC3D9 \uB4E4\uC5B4\uAC00\uC694.", bg: "gate" },
  clear: { scene: "\uC0B0\uCC45 \uC644\uB8CC", mission: "\uC0B0\uCC45 \uC644\uB8CC! \uB8E8\uBE44\uC640 \uAC10\uC790\uAC00 \uD589\uBCF5\uD574 \uBCF4\uC5EC\uC694.", bg: "home" },
  fail: { scene: "\uC0B0\uCC45 \uC2E4\uD328", mission: "\uC0B0\uCC45 \uC2E4\uD328... \uB2E4\uC2DC \uB3C4\uC804\uD574\uBCFC\uAE4C\uC694?", bg: "home" },
};

export default function WalkQuestGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [message, setMessage] = useState("\uB8E8\uBE44\uC640 \uAC10\uC790\uAC00 \uC0B0\uCC45\uC744 \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC5B4\uC694.");
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
  const [poopStep, setPoopStep] = useState<PoopStep>("ask");
  const [runTaps, setRunTaps] = useState(0);
  const [carStopped, setCarStopped] = useState(false);
  const [dogsRoadside, setDogsRoadside] = useState(false);
  const [bossLane, setBossLane] = useState<Lane>("center");
  const [bossBlocks, setBossBlocks] = useState(0);
  const [carGuide, setCarGuide] = useState(false);
  const [hearts, setHearts] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [dangerToast, setDangerToast] = useState<string | null>(null);
  const walkForwardRef = useRef(0);
  const successToastTimerRef = useRef<number | null>(null);
  const dangerToastTimerRef = useRef<number | null>(null);
  const gateBarkAudioRef = useRef<HTMLAudioElement | null>(null);
  const catAudioRef = useRef<HTMLAudioElement | null>(null);
  const heldMovementKeysRef = useRef(new Set<string>());
  const ignoredCommandKeysRef = useRef(new Set<string>());
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const commandInputUnlockAtRef = useRef(0);

  const info = phaseInfo[phase];
  const needsInput = ["living", "leashPrep", "pull", "car", "barkingDog", "cat", "catFood"].includes(phase);
  const showDogs = false;
  const useEmptyHome = (phase === "living" && calledDogs) || phase === "excited";

  useEffect(() => {
    commandInputUnlockAtRef.current = needsInput ? Date.now() + 500 : Number.POSITIVE_INFINITY;
    if (!needsInput) return;

    const timer = window.setTimeout(() => {
      commandInputRef.current?.focus();
    }, 500);

    return () => window.clearTimeout(timer);
  }, [needsInput, phase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (movementKeyCodes.includes(event.code)) heldMovementKeysRef.current.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!movementKeyCodes.includes(event.code)) return;
      heldMovementKeysRef.current.delete(event.code);
      ignoredCommandKeysRef.current.delete(event.code);
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, []);

  useEffect(() => {
    if (!needsInput) {
      ignoredCommandKeysRef.current.clear();
      return;
    }

    ignoredCommandKeysRef.current = new Set(heldMovementKeysRef.current);
  }, [needsInput, phase]);

  const showSuccessToast = useCallback((mission = "미션") => {
    const lines = [
      `${mission} 성공! 루감이 산책력 +1`,
      `${mission} 성공! 보호자 센스가 반짝였어요.`,
      `${mission} 성공! 루비와 감자가 꼬리로 박수치는 중!`,
      `${mission} 성공! 오늘 산책 아주 순조로워요.`,
    ];
    const nextLine = lines[Math.floor(Math.random() * lines.length)];

    if (successToastTimerRef.current !== null) {
      window.clearTimeout(successToastTimerRef.current);
    }

    setSuccessToast(nextLine);
    successToastTimerRef.current = window.setTimeout(() => {
      setSuccessToast(null);
      successToastTimerRef.current = null;
    }, 2200);
  }, []);

  const showDangerToast = useCallback((text: string) => {
    if (dangerToastTimerRef.current !== null) {
      window.clearTimeout(dangerToastTimerRef.current);
    }

    setDangerToast(text);
    dangerToastTimerRef.current = window.setTimeout(() => {
      setDangerToast(null);
      dangerToastTimerRef.current = null;
    }, 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (successToastTimerRef.current !== null) {
        window.clearTimeout(successToastTimerRef.current);
      }
      if (dangerToastTimerRef.current !== null) {
        window.clearTimeout(dangerToastTimerRef.current);
      }
    };
  }, []);

  function showHearts(text: string) {
    setMessage(text);
    setHearts(true);
    playSound("success");
    showSuccessToast();
    window.setTimeout(() => setHearts(false), 1300);
  }

  function reset() {
    setPhase("intro");
    setMessage("\uB8E8\uBE44\uC640 \uAC10\uC790\uAC00 \uC0B0\uCC45\uC744 \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC5B4\uC694.");
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
    setPoopStep("ask");
    setRunTaps(0);
    setCarStopped(false);
    setDogsRoadside(false);
    setBossLane("center");
    setBossBlocks(0);
    setCarGuide(false);
    setHearts(false);
    setSuccessToast(null);
    if (successToastTimerRef.current !== null) {
      window.clearTimeout(successToastTimerRef.current);
      successToastTimerRef.current = null;
    }
    walkForwardRef.current = 0;
  }

  function start() {
    playSound("happy");
    reset();
    setPhase("upstairs");
    setMessage("2\uCE35\uC785\uB2C8\uB2E4. \uC544\uB798\uCE35\uC5D0\uC11C \uC870\uC6A9\uD55C \uAC15\uC544\uC9C0 \uAE30\uCC99\uC774 \uB290\uAEF4\uC838\uC694. 1\uCE35\uC73C\uB85C \uB0B4\uB824\uAC00 \uBCFC\uAE4C\uC694?");
  }

  const reachEntry = useCallback(() => {
    setPhase("leashPrep");
    setMessage("\uD604\uAD00\uC5D0 \uB3C4\uCC29\uD588\uC5B4\uC694. \uC0B0\uCC45\uC774\uB77C\uB294 \uB9D0\uC5D0 \uD765\uBD84\uD55C \uAC15\uC544\uC9C0\uB4E4\uC744 \uC549\uD600\uBCFC\uAE4C\uC694?");
  }, []);

  const reachLiving = useCallback(() => {
    setPhase("living");
    setMessage("1\uCE35 \uAC70\uC2E4\uC785\uB2C8\uB2E4. \uB8E8\uBE44\uC640 \uAC10\uC790\uB97C \uBD88\uB7EC\uBCF4\uC138\uC694.");
  }, []);

  const reachGate = useCallback(() => {
    setPhase("gate");
    setMessage("\uB300\uBB38 \uC55E\uC774\uC5D0\uC694. \uB8E8\uBE44\uB294 \uBE59\uAE00\uBE59\uAE00 \uB3CC\uACE0, \uAC10\uC790\uB294 \uC2E0\uB098\uC11C \uC9D6\uACE0 \uC788\uC5B4\uC694.");
  }, []);

  const handleWalkForward = useCallback((delta: number) => {
    if (phase !== "walk") return;
    walkForwardRef.current += delta;

    if (walkStep === 0 && walkForwardRef.current >= 3) {
      walkForwardRef.current = 0;
      setPhase("pull");
      setTimeLeft(7);
      setMessage("\uB8E8\uBE44\uAC00 \uC904\uC744 \uB2F9\uAE30\uAE30 \uC2DC\uC791\uD588\uC5B4\uC694. 7\uCD08 \uC548\uC5D0 \uCC9C\uCC9C\uD788\uB77C\uACE0 \uC785\uB825\uD558\uC138\uC694!");
      return;
    }

    if (walkStep === 1 && walkForwardRef.current >= 15) {
      walkForwardRef.current = 0;
      setPhase("poop");
      setPoopStep("ask");
      setPoopTool(null);
      setMessage("주의! 감자가 똥을 쌌어요. 펫티켓을 지키겠습니까?");
      return;
    }

    if (walkStep === 2 && walkForwardRef.current >= 3) {
      walkForwardRef.current = 0;
      setPhase("car");
      setCarStopped(false);
      setDogsRoadside(false);
      setCarGuide(true);
      setTimeLeft(null);
      setMessage("\uC18D\uB3C4\uB97C \uB530\uB77C\uC7A1\uC558\uC5B4\uC694! \uADF8\uB7F0\uB370 \uC55E\uC5D0 \uCC28\uAC00 \uC624\uB124\uC694! \uC5BC\uB978 \uBA48\uCDB0\uB77C\uACE0 \uC785\uB825\uD558\uACE0, \uB8E8\uAC10\uC774\uB97C \uD480\uCABD\uC73C\uB85C \uC62E\uAE34 \uB4A4 \uAE30\uB2E4\uB824\uB77C\uACE0 \uC785\uB825\uD558\uC138\uC694!");
      return;
    }

    if (walkStep === 3 && walkForwardRef.current >= 15) {
      walkForwardRef.current = 0;
      setPhase("barkingDog");
      setTimeLeft(5);
      setMessage("\uAE38\uAC00 \uC9D1 \uC815\uC6D0\uC5D0\uC11C \uB2E4\uB978 \uAC15\uC544\uC9C0\uAC00 \uC9D6\uC5B4\uC694. 5\uCD08 \uC548\uC5D0 \uBB34\uC2DC\uD574\uB77C\uACE0 \uC785\uB825\uD558\uC138\uC694.");
      return;
    }

    if (walkStep === 4 && walkForwardRef.current >= 3) {
      walkForwardRef.current = 0;
      setPhase("boss");
      setBossBlocks(-4);
      setBossLane(randomLane());
      setTimeLeft(null);
      setMessage("멀리서 낮게 짖는 소리가 들려요...");
      return;
    }

    if (walkStep === 5 && walkForwardRef.current >= 3) {
      walkForwardRef.current = 0;
      setPhase("cat");
      setTimeLeft(5);
      setMessage("\uACE0\uC591\uC774\uAC00 \uC67C\uCABD\uC5D0 \uB098\uD0C0\uB0AC\uC5B4\uC694! \uAC10\uC790\uAC00 \uCA53\uC544\uAC00\uB824\uACE0 \uD574\uC694. 5\uCD08 \uC548\uC5D0 \uC548\uB3FC\uB77C\uACE0 \uC785\uB825\uD558\uC138\uC694!");
      return;
    }

    if (walkStep === 6 && walkForwardRef.current >= 3) {
      walkForwardRef.current = 0;
      setPhase("catFood");
      setTimeLeft(3);
      setMessage("왼쪽에 길고양이 밥이 있어요! 루비가 냄새를 맡고 확 달려들어요. 3초 안에 먹지마라고 입력하세요!");
      return;
    }

    if (walkStep >= 7 && walkForwardRef.current >= 3) {
      walkForwardRef.current = 0;
      setPhase("home");
      setMessage("\uC9D1 \uC55E\uC5D0 \uAC70\uC758 \uB3C4\uCC29\uD588\uC5B4\uC694.");
    }
  }, [phase, walkStep]);

  function fall(reason: string) {
    playSound("fall");
    const next = falls + 1;
    setFalls(next);
    setTimeLeft(null);
    if (next >= 3) {
      setPhase("fail");
      setMessage(`${reason} 3\uBC88 \uB118\uC5B4\uC838\uC11C \uC624\uB298 \uC0B0\uCC45\uC740 \uC2E4\uD328\uD588\uC5B4\uC694.`);
      return;
    }
    setPhase("walk");
    setMessage(`${reason} \uB118\uC5B4\uC9D0 ${next}/3. \uB2E4\uC2DC \uCE68\uCC29\uD558\uAC8C \uAC78\uC5B4\uC694.`);
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
          setTimeLeft(null);
          const nextFalls = falls + 1;
          setFalls(nextFalls);
          playSound("fall");
          if (nextFalls >= 3) {
            setPhase("fail");
            setMessage("5\uCD08 \uC548\uC5D0 \uBAA9\uC904\uC744 \uBABB \uCC44\uC6CC \uAC15\uC544\uC9C0\uB4E4\uC774 \uB2E4\uC2DC \uC77C\uC5B4\uB0AC\uC5B4\uC694. 3\uBC88 \uB118\uC5B4\uC838\uC11C \uC624\uB298 \uC0B0\uCC45\uC740 \uC2E4\uD328\uD588\uC5B4\uC694.");
          } else {
            setPhase("leashPrep");
            setMessage("5\uCD08 \uC548\uC5D0 \uBAA9\uC904\uC744 \uBABB \uCC44\uC6CC \uAC15\uC544\uC9C0\uB4E4\uC774 \uB2E4\uC2DC \uC77C\uC5B4\uB0AC\uC5B4\uC694. \uD765\uBD84\uD55C \uAC15\uC544\uC9C0\uB4E4\uC5D0\uAC8C \uBC1C\uC774 \uAC78\uB824 \uB118\uC5B4\uC84C\uC5B4\uC694. \uB118\uC5B4\uC9D0 " + nextFalls + "/3. \uB2E4\uC2DC \uC549\uC544\uBD80\uD130 \uD574\uBCFC\uAE4C\uC694?");
          }
        } else if (phase === "pull") {
          fall("7\uCD08 \uC548\uC5D0 \uCC9C\uCC9C\uD788\uB77C\uACE0 \uB9D0\uD558\uC9C0 \uBABB\uD574 \uB118\uC5B4\uC84C\uC5B4\uC694.");
        } else if (phase === "car") {
          fall("\uCC28\uB97C \uD53C\uD558\uB294 \uB3D9\uC791\uC774 \uB2A6\uC5B4 \uB118\uC5B4\uC84C\uC5B4\uC694.");
        } else if (phase === "barkingDog") {
          fall("5\uCD08 \uC548\uC5D0 \uBB34\uC2DC\uD574\uB77C\uACE0 \uB9D0\uD558\uC9C0 \uBABB\uD574 \uB118\uC5B4\uC84C\uC5B4\uC694.");
        } else if (phase === "boss") {
          hardFail("\uBE14\uB85C\uD0B9 \uC2E4\uD328. \uB8E8\uBE44\uC640 \uAC10\uC790\uAC00 \uC704\uD5D8\uD574\uC838 \uBC14\uB85C \uC2E4\uD328\uD588\uC5B4\uC694.");
        } else if (phase === "cat") {
          fall("감자가 고양이를 쫓으려 해서 넘어졌어요.");
        } else if (phase === "catFood") {
          fall("루비가 길고양이 밥으로 달려들어 넘어졌어요.");
        } else if (phase === "run") {
          fall("뛰는 속도를 따라잡지 못해 넘어졌어요.");
        }
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    const timer = window.setTimeout(() => setTimeLeft((current) => (current === null ? null : current - 1)), 1000);
    return () => window.clearTimeout(timer);
    // Timeout handlers intentionally use the current phase snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [falls, phase, timeLeft]);

  useEffect(() => {
    if (phase !== "walk") return;
    const peeTimer = window.setInterval(() => {
      setPeePulse(true);
      window.setTimeout(() => setPeePulse(false), 2400);
    }, 15000);

    return () => window.clearInterval(peeTimer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "run") return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      event.preventDefault();
      setRunTaps((current) => {
        const next = current + 1;
        if (next >= 18) {
          setPhase("car");
          setTimeLeft(10);
          setCarStopped(false);
          setDogsRoadside(false);
          showHearts("속도를 따라잡았어요! 그런데 앞에 차가 오네요! 얼른 피해주세요!!");
        }
        return next;
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase]);

  useEffect(() => {
    if (phase !== "enterHome") return;
    playSound("success");
    const timer = window.setTimeout(() => {
      setPhase("clear");
      setMessage("산책 완료! 루비와 감자가 행복해 보여요.");
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [phase]);

  function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (Date.now() < commandInputUnlockAtRef.current) return;
    const command = input.trim();
    if (!command) return;
    runCommand(command);
    setInput("");
  }

  function handleCommandKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (Date.now() < commandInputUnlockAtRef.current) {
      event.preventDefault();
      return;
    }
    if (!ignoredCommandKeysRef.current.has(event.code)) return;
    event.preventDefault();
  }

  function runCommand(command: string) {
    if (phase === "living") {
      if (!calledDogs && callWords.some((word) => command.includes(word))) {
        setCalledDogs(true);
        playSound("bark");
        showHearts("루비와 감자가 내 앞으로 달려왔어요. 산책가자고 말해볼까요?");
      } else if (calledDogs && walkWords.some((word) => command.includes(word))) {
        setPhase("excited");
        playSound("success");
        showHearts("강아지들이 신나서 콩콩 뛰기 시작했어요. 목줄과 똥봉투가 있는 현관쪽으로 가볼까요?");
      } else if (calledDogs) {
        setMessage("산책, 나가자, 나갈까 중 하나를 말해보세요.");
      } else {
        setMessage("루비, 감자를 불러보세요.");
      }
      return;
    }
    if (phase === "leashPrep") {
      if (command.includes("앉아")) {
        setDogsSitting(true);
        setPhase("leashMission");
        setTimeLeft(5);
        playSound("leash");
        setMessage("강아지들이 차분히 앉았어요. 다시 일어나기 전에 빨리 목줄을 채워봐요. 목줄을 강아지에게 드래그 하면 목줄을 채울 수 있어요!");
      } else {
        setMessage("먼저 앉아를 말해서 강아지들을 진정시켜 주세요.");
      }
      return;
    }
    if (phase === "pull") {
      if (command.includes("천천히")) {
        setTimeLeft(null);
        resumeWalk("루비가 속도를 줄였어요. 다시 앞으로 가볼까요?");
      } else {
        setMessage("루비가 줄을 당겨요. 7초 안에 천천히라고 입력하세요.");
      }
      return;
    }
    if (phase === "car") {
      if (!carStopped && command.includes("멈춰")) {
        playSound("car");
        setCarGuide(false);
        setCarStopped(true);
        setTimeLeft(10);
        setMessage("멈췄어요. 루비와 감자를 길가 쪽으로 옮긴 뒤 기다려라고 입력하세요.");
      } else if (carGuide) {
        setMessage("차가 다가오고 있어요. 멈춰라고 입력해도 괜찮아요.");
      } else if (carStopped && dogsRoadside && command.includes("기다려")) {
        finishCar();
      } else if (carStopped && !dogsRoadside) {
        setMessage("루비와 감자를 길가로 옮겨주세요.");
      } else {
        setMessage("차가 와요. 먼저 멈춰라고 입력하세요.");
      }
      return;
    }
    if (phase === "barkingDog") {
      if (command.includes("무시해")) {
        ignoreDog();
      } else {
        setMessage("옆집 개가 맹렬히 짖고 있어요. 5초 안에 무시해라고 입력하세요.");
      }
      return;
    }
    if (phase === "cat") {
      if (command.includes("안돼")) {
        setTimeLeft(null);
        resumeWalk("감자가 멈췄어요. 고양이는 무사히 지나갔어요.");
      } else {
        setMessage("감자가 고양이를 쫓아가려 해요. 5초 안에 안돼라고 입력하세요.");
      }
      return;
    }
    if (phase === "catFood") {
      if (command.includes("먹지마")) {
        setTimeLeft(null);
        resumeWalk("루비가 길고양이 밥을 포기했어요. 조금만 더 걸어가면 집이에요.");
      } else {
        setMessage("루비가 길고양이 밥을 먹으려고 뛰어들어요. 3초 안에 먹지마라고 입력하세요.");
      }
      return;
    }
  }

  function sitDogs() {
    setDogsSitting(true);
    playSound("success");
    showHearts("루비와 감자가 차분히 앉았어요.");
  }

  function startLeash() {
    if (!dogsSitting) {
      setMessage("먼저 앉아를 해야 목줄을 안전하게 채울 수 있어요.");
      return;
    }
    setPhase("leashMission");
    setTimeLeft(5);
    playSound("leash");
    setMessage("강아지들이 차분히 앉았어요. 다시 일어나기 전에 빨리 목줄을 채워봐요. 목줄을 강아지에게 드래그하면 목줄을 채울 수 있어요!");
  }

  function openLeashZoom(target: Dog) {
    if ((target === "ruby" && rubyLeashed) || (target === "gamja" && gamjaLeashed)) {
      setMessage((target === "ruby" ? "루비" : "감자") + "는 이미 목줄을 찼어요.");
      return;
    }
    setZoomDog(target);
    setPhase("leashZoom");
    playSound("leash");
    setMessage((target === "ruby" ? "루비" : "감자") + "에게 목줄을 채워주세요.");
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
      showHearts("목줄 착용 완료! 잊은 물건이 있지 않은지 확인하고 나가세요.");
    } else {
      setPhase("leashMission");
      setMessage("좋아요. 남은 목줄을 해당 강아지에게 드래그해서 채워주세요.");
    }
  }

  function goOut() {
    setPhase("garden");
    playSound("step");
    setMessage(hasPoopBag ? "똥봉투까지 챙겼어요. 정원으로 나왔습니다. 대문 밖으로 나가 본격적인 산책 해볼까요?" : "똥봉투는 없지만 정원으로 나왔어요. 대문 밖으로 나가 본격적인 산책 해볼까요?");
  }

  function openGate() {
    if (!rubyCalm || !gamjaQuiet) {
      showDangerToast("앉아 / 조용히 해를 하지 않고 대문을 열어서 넘어졌어요!");
      fall("대문을 그냥 열자 루비가 뛰고 감자가 짖어서 넘어졌어요.");
      setPhase("gate");
      return;
    }
    setPhase("walk");
    playSound("step");
    setWalkStep(0);
    walkForwardRef.current = 0;
    setMessage("늘 가던 산책길이에요. 앞으로 가볼까요?");
  }

  function resumeWalk(text: string) {
    setWalkStep((current) => current + 1);
    walkForwardRef.current = 0;
    setPoopTool(null);
    setPoopStep("ask");
    setCarGuide(false);
    setPhase("walk");
    showHearts(text);
  }

  function choosePoopTool(tool: PoopTool) {
    setPoopTool(tool);
    playSound("poop");
    if (tool === "leaf") {
      setPoopStep("leafReady");
      setMessage("풀숲에서 나뭇잎을 찾아 똥을 주워보세요.");
    }
    if (tool === "sock") {
      setPoopStep("sockReady");
      setMessage("양말을 벗었어요. 손에 든 양말을 똥으로 옮겨주세요.");
    }
    if (tool === "bag") {
      setPoopStep("bagCheck");
      setMessage("똥봉투를 똥 위로 옮겨주세요.");
    }
  }

  function dropPoopTool(toolOverride?: PoopTool) {
    const selectedTool = toolOverride ?? poopTool;
    if (selectedTool === "bag") {
      setPoopTool(null);
      resumeWalk("펫티켓 완료!");
    } else if (selectedTool === "leaf") {
      setPoopTool(null);
      setPoopStep("sockAsk");
      setMessage("나뭇잎이 너무 작아요! 손에 묻어버렸어요... 어쩔 수 없다... 양말뿐인건가..?");
    } else if (selectedTool === "sock") {
      setPoopTool(null);
      resumeWalk("양말은 잃었지만 환경은 지켜냈어요!");
    } else {
      setMessage("먼저 처리할 도구를 선택하세요.");
    }
  }

  function ignoreDog() {
    setTimeLeft(null);
    playSound("bark");
    resumeWalk("무시해 성공! 루비와 감자가 조용히 지나가요.");
  }

  function blockBoss() {
    setTimeLeft(null);
    setWalkStep(5);
    setPhase("walk");
    showHearts("사나운 강아지를 막아냈어요. 조금만 더 걸어가면 집이에요.");
  }

  function clickBossDog() {
    if (bossBlocks < 0) return;
    setBossBlocks((current) => {
      const next = current + 1;
      if (next >= 3) {
        blockBoss();
      } else {
        setBossLane(randomLane());
        setTimeLeft(3);
        setMessage(`좋아요! ${next}/3번 막았어요. 다시 나타나는 개를 3초 안에 클릭하세요!`);
      }
      return next;
    });
  }

  function finishCar() {
    if (!carStopped) {
      setMessage("먼저 멈춰를 입력해야 해요.");
      return;
    }
    if (!dogsRoadside) {
      setMessage("루감이를 길 옆 풀쪽으로 옮겨야 해요.");
      return;
    }
    resumeWalk("루감이를 안전하게 지켜냈어요! 다시 산책을 해볼까요?");
  }

  useEffect(() => {
    if (phase === "car") playSound("car");
    if (phase === "poop") playSound("poop");
    if (phase === "run") playSound("happy");
  }, [phase]);

  useEffect(() => {
    if (phase !== "boss" || bossBlocks >= 0) return;
    const bossIntro: Record<number, { next: number; delay: number; message: string }> = {
      [-4]: { next: -3, delay: 1400, message: "루비가 귀를 쫑긋 세웠어요. 뭔가 다가오는 것 같아요." },
      [-3]: { next: -2, delay: 1400, message: "감자가 몸을 낮추고 긴장했어요. 목줄을 꽉 잡아야 해요." },
      [-2]: { next: -1, delay: 1400, message: "땅이 울리는 것처럼 화면이 흔들려요. 곧 튀어나올 것 같아요!" },
      [-1]: { next: 0, delay: 1600, message: "사나운 강아지가 나타났어요! 3초 안에 강아지를 클릭하세요." },
    };
    const intro = bossIntro[bossBlocks];
    if (!intro) return;
    const guideTimer = window.setTimeout(() => {
      setBossBlocks(intro.next);
      setMessage(intro.message);
      if (intro.next === 0) {
        setBossLane(randomLane());
        setTimeLeft(3);
      }
    }, intro.delay);
    return () => window.clearTimeout(guideTimer);
  }, [bossBlocks, phase]);

  useEffect(() => {
    if (phase !== "car" || !carGuide) return;
    const guideTimer = window.setTimeout(() => {
      setCarGuide(false);
      setTimeLeft(10);
      setMessage("차가 가까워져요! 멈춰를 입력하고 루비와 감자를 길가쪽으로 옮긴 뒤 기다려를 입력하세요.");
    }, 3000);
    return () => window.clearTimeout(guideTimer);
  }, [carGuide, phase]);

  useEffect(() => {
    gateBarkAudioRef.current?.pause();
    gateBarkAudioRef.current = null;
    if (phase !== "gate" || gamjaQuiet) return;

    const audio = new Audio(animal.gamjaGateBarkAudio);
    audio.loop = true;
    audio.volume = 0.78;
    gateBarkAudioRef.current = audio;
    void audio.play().catch(() => {
      playSound("bark");
    });

    return () => {
      audio.pause();
      audio.currentTime = 0;
      if (gateBarkAudioRef.current === audio) {
        gateBarkAudioRef.current = null;
      }
    };
  }, [gamjaQuiet, phase]);

  useEffect(() => {
    catAudioRef.current?.pause();
    catAudioRef.current = null;
    if (phase !== "cat") return;

    const audio = new Audio(animal.catAudio);
    audio.loop = true;
    audio.volume = 0.64;
    catAudioRef.current = audio;
    void audio.play().catch(() => {});

    return () => {
      audio.pause();
      audio.currentTime = 0;
      if (catAudioRef.current === audio) {
        catAudioRef.current = null;
      }
    };
  }, [phase]);

  const dogPose = useMemo(() => {
    if (phase === "intro" || phase === "clear") return "heart";
    if (phase === "living" && !calledDogs) return "sleep";
    if (phase === "living" && calledDogs) return "call";
    if (phase === "excited" || phase === "leashPrep") return dogsSitting ? "sit" : "hop";
    if (phase === "leashMission") return "sit";
    if (phase === "leashZoom" || phase === "gate") return "sit";
    if (phase === "pull" || phase === "run") return "run";
    if (phase === "poop") return "poop";
    if (phase === "catFood") return "walk";
    if (phase === "barkingDog" || phase === "boss" || phase === "car") return "alert";
    return "walk";
  }, [calledDogs, dogsSitting, phase]);

  const commandPlaceholder = phase === "pull"
    ? "천천히"
    : phase === "car"
      ? carStopped ? "기다려" : "멈춰"
      : phase === "barkingDog"
        ? "무시해"
        : phase === "cat"
          ? "안돼"
          : phase === "catFood"
            ? "먹지마"
            : phase === "living"
              ? calledDogs ? "산책가자" : "루비와 감자를 불러보세요"
              : "입력";

  const handleGameClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    const button = (event.target as HTMLElement).closest("button");
    if (!button || button.disabled) return;
    playSound("click");
  }, []);

  return (
    <main className="walk-page">
      <Link href="/" className="back-link">{"메인으로"}</Link>
      <section className={`game ${phase === "intro" ? "intro-mode" : ""}`} onClickCapture={handleGameClick}>
        {phase !== "intro" && (
        <header className="topbar">
          <div>
            <p>현실형 1인칭 산책 미션</p>
            <h1>루비 감자와 산책</h1>
          </div>
          <div className="hud-pills">
            <Pill label="넘어짐" value={`${falls}/3`} alert={falls > 0} />
            <Pill label="시간" value={timeLeft === null ? "-" : `${timeLeft}s`} alert={timeLeft !== null && timeLeft <= 3} />
            <Pill label="루비 목줄" value={rubyLeashed ? "착용" : "미착용"} />
            <Pill label="감자 목줄" value={gamjaLeashed ? "착용" : "미착용"} />
            <Pill label="봉투" value={hasPoopBag ? "있음" : "없음"} alert={!hasPoopBag && phase === "poop"} />
          </div>
        </header>
        )}

        <section className={`scene bg-${info.bg} ${useEmptyHome ? "called-dogs" : ""} ${needsInput ? "input-open" : ""}`}>
          {phase !== "intro" && phase !== "clear" && phase !== "fail" && (
            <ThreeWalkWorld
              phase={phase}
              calledDogs={calledDogs}
              canReachEntry={phase === "excited" || dogsSitting}
              rubyCalm={rubyCalm}
              gamjaQuiet={gamjaQuiet}
              dogsRoadside={dogsRoadside}
              onReachLiving={reachLiving}
              onReachEntry={reachEntry}
              onReachGate={reachGate}
              onWalkForward={handleWalkForward}
              movementLocked={needsInput}
            />
          )}
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
            poopStep={poopStep}
            carStopped={carStopped}
            dogsRoadside={dogsRoadside}
            bossLane={bossLane}
            bossBlocks={bossBlocks}
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
            setPoopStep={setPoopStep}
            choosePoopTool={choosePoopTool}
            dropPoopTool={dropPoopTool}
            setCarStopped={setCarStopped}
            setDogsRoadside={setDogsRoadside}
            finishCar={finishCar}
            ignoreDog={ignoreDog}
            blockBoss={blockBoss}
            clickBossDog={clickBossDog}
            carGuide={carGuide}
            showSuccessToast={showSuccessToast}
          />
          {successToast && (
            <div className="success-toast" role="status" aria-live="polite">
              {successToast}
            </div>
          )}
          {dangerToast && (
            <div className="danger-toast" role="alert" aria-live="assertive">
              {dangerToast}
            </div>
          )}
          {phase !== "intro" && (
            <div className="scene-caption">
              <b>{info.scene}</b>
              <span>{message}</span>
            </div>
          )}
          {needsInput && (
            <form className="command" onSubmit={submitCommand}>
              <input
                ref={commandInputRef}
                value={input}
                onChange={(event) => {
                  if (Date.now() < commandInputUnlockAtRef.current) return;
                  setInput(event.target.value);
                }}
                onKeyDown={handleCommandKeyDown}
                placeholder={commandPlaceholder}
                autoFocus
              />
              <button type="submit">{"말하기"}</button>
            </form>
          )}
        </section>
      </section>

      <style jsx global>{`
        @import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css");
        @import url("https://fonts.googleapis.com/css2?family=Dongle:wght@400;700&family=Gaegu:wght@400;700&family=Gowun+Dodum&family=Jua&family=Poor+Story&family=Single+Day&display=swap");
        html,
        body {
          margin: 0;
        }
      `}</style>
      <style jsx>{`
        .walk-page {
          min-height: 100vh;
          box-sizing: border-box;
          padding: 14px 18px 18px;
          background:
            radial-gradient(circle at 16% 4%, rgba(255, 237, 189, 0.82), transparent 18rem),
            radial-gradient(circle at 82% 14%, rgba(184, 222, 255, 0.7), transparent 24rem),
            linear-gradient(135deg, #f9efd7, #d8eef7 55%, #e8f3d2);
          color: #231a15;
          font-family: 'Poor Story', 'Pretendard', sans-serif;
          font-size: 1.05rem;
        }

        .walk-page :global(button),
        .walk-page :global(.gate-action),
        .walk-page :global(.bag-button) {
          font-family: 'Jua', 'Poor Story', 'Pretendard', sans-serif;
        }

        .walk-page :global(input),
        .walk-page :global(textarea),
        .walk-page :global(select) {
          font-family: 'Poor Story', 'Pretendard', sans-serif;
        }

        .back-link {
          color: #60442f;
          font-weight: 900;
          text-decoration: none;
        }

        .game {
          max-width: 1180px;
          height: min(780px, calc(100vh - 58px));
          min-height: 620px;
          margin: 10px auto 0;
          border: 2px solid rgba(72, 50, 35, 0.28);
          border-radius: 24px;
          background: #fffaf1;
          overflow: hidden;
          box-shadow: 0 28px 80px rgba(37, 28, 22, 0.28);
          display: flex;
          flex-direction: column;
        }

        .topbar {
          display: flex;
          flex: 0 0 auto;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: end;
          gap: 18px;
          padding: 14px 18px 12px;
          border-bottom: 1px solid rgba(135, 101, 66, 0.18);
          background: linear-gradient(180deg, #fff7e8, #f2d9ad);
          color: #4b3424;
        }

        .topbar p {
          margin: 0 0 3px;
          color: #8b674c;
          font-size: 0.94rem;
          font-weight: 900;
        }

        h1 {
          margin: 0;
          font-family: 'Jua', 'Poor Story', 'Pretendard', sans-serif;
          font-size: clamp(1.9rem, 4.2vw, 3.2rem);
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
          flex: 1 1 auto;
          min-height: 0;
          overflow: hidden;
          background: #f2eee8;
          border-top: 1px solid rgba(255,255,255,0.12);
          border-bottom: 1px solid rgba(255,255,255,0.12);
        }

        .success-toast {
          position: absolute;
          z-index: 80;
          left: 50%;
          top: 18%;
          max-width: min(520px, calc(100% - 48px));
          transform: translateX(-50%);
          padding: 16px 24px 18px;
          border: 2px solid rgba(102, 161, 67, 0.42);
          border-radius: 24px;
          background: linear-gradient(180deg, rgba(234, 255, 214, 0.98), rgba(199, 239, 165, 0.96));
          box-shadow: 0 22px 58px rgba(59, 110, 41, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.72);
          color: #31551f;
          font-family: 'Jua', 'Poor Story', 'Pretendard', sans-serif;
          font-size: clamp(1.15rem, 2.4vw, 1.65rem);
          font-weight: 900;
          text-align: center;
          pointer-events: none;
          animation: success-pop 2.2s ease both;
        }

        .danger-toast {
          position: absolute;
          z-index: 82;
          left: 50%;
          top: 22%;
          max-width: min(560px, calc(100% - 48px));
          transform: translateX(-50%);
          padding: 17px 24px 19px;
          border: 2px solid rgba(213, 91, 99, 0.45);
          border-radius: 24px;
          background: linear-gradient(180deg, rgba(255, 232, 232, 0.99), rgba(255, 185, 194, 0.96));
          box-shadow: 0 24px 60px rgba(122, 42, 48, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.7);
          color: #682d33;
          font-family: 'Jua', 'Poor Story', 'Pretendard', sans-serif;
          font-size: clamp(1.18rem, 2.5vw, 1.7rem);
          font-weight: 950;
          text-align: center;
          pointer-events: none;
          animation: success-pop 2.2s ease both;
        }

        @keyframes success-pop {
          0% {
            opacity: 0;
            transform: translate(-50%, 10px) scale(0.92);
          }
          12%,
          78% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -8px) scale(0.98);
          }
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
            linear-gradient(90deg, rgba(255,247,233,0.22), rgba(255,247,233,0.02) 46%, rgba(255,247,233,0.12)),
            url("/ruby-gamja/custom/opening-ruby-gamja.jpg") center / cover no-repeat;
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
            radial-gradient(circle at 18% 26%, rgba(255,255,255,0.62), transparent 14rem),
            linear-gradient(180deg, #b9d8cf 0 38%, #87ad77 38% 55%, #5f774f 55% 100%);
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

        .bg-stairs .first-person {
          display: none;
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

        .scene-caption b {
          font-family: 'Jua', 'Poor Story', 'Pretendard', sans-serif;
        }

        .scene-caption span {
          font-family: 'Poor Story', 'Pretendard', sans-serif;
        }

        @media (max-width: 820px) {
          .walk-page {
            padding: 8px;
          }

          .game {
            height: calc(100vh - 38px);
            min-height: 560px;
          }

          .topbar {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
          }

          .progress-trail {
            overflow-x: auto;
            padding-bottom: 2px;
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
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #d79d71;
          box-shadow: 0 0 0 3px rgba(215, 157, 113, 0.12);
          flex: 0 0 auto;
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

function ThreeWalkWorld({
  phase,
  calledDogs,
  canReachEntry = true,
  rubyCalm,
  gamjaQuiet,
  dogsRoadside,
  onReachLiving,
  onReachEntry,
  onReachGate,
  onWalkForward,
  movementLocked = false,
}: {
  phase: Phase;
  calledDogs: boolean;
  canReachEntry?: boolean;
  rubyCalm: boolean;
  gamjaQuiet: boolean;
  dogsRoadside: boolean;
  onReachLiving?: () => void;
  onReachEntry?: () => void;
  onReachGate?: () => void;
  onWalkForward?: (delta: number) => void;
  movementLocked?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef({ x: 0, z: 5.5, yaw: 0 });
  const keysRef = useRef(new Set<string>());
  const stepAudioRef = useRef<HTMLAudioElement | null>(null);
  const reachedEntryRef = useRef(false);
  const rubyCalmRef = useRef(rubyCalm);
  const gamjaQuietRef = useRef(gamjaQuiet);
  const dogsRoadsideRef = useRef(dogsRoadside);
  const outdoorPhases: Phase[] = ["garden", "gate", "walk", "pull", "poop", "run", "car", "barkingDog", "boss", "cat", "catFood", "home", "enterHome"];
  const isOutdoor = outdoorPhases.includes(phase);

  useEffect(() => {
    if (!movementLocked) return;
    keysRef.current.clear();
    const audio = stepAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    stepAudioRef.current = null;
  }, [movementLocked]);

  useEffect(() => {
    rubyCalmRef.current = rubyCalm;
    gamjaQuietRef.current = gamjaQuiet;
    dogsRoadsideRef.current = dogsRoadside;
  }, [rubyCalm, gamjaQuiet, dogsRoadside]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    reachedEntryRef.current = false;
    if (phase === "upstairs") positionRef.current = { x: -3.6, z: 8.2, yaw: 0 };
    if (phase === "garden") positionRef.current = { x: 0, z: 6.8, yaw: 0 };
    if (phase === "gate") positionRef.current = { x: 0, z: -5.2, yaw: 0 };
    if (["walk", "pull", "poop", "run", "car", "barkingDog", "boss", "cat", "catFood", "home", "enterHome"].includes(phase)) positionRef.current = { x: 0, z: 7.2, yaw: 0 };

    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isOutdoor ? "#cfe6c4" : "#f4eadc");
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
      color: isOutdoor ? "#86b86a" : "#eee5d8",
      roughness: 0.62,
      metalness: 0.02,
    });
    const floorDepth = isOutdoor && !["garden", "gate"].includes(phase) ? 120 : 42;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, floorDepth), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = isOutdoor && !["garden", "gate"].includes(phase) ? -38 : 0;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(34, 18, isOutdoor ? "#9fc184" : "#c8b9a7", isOutdoor ? "#b9d4a6" : "#e2d7ca");
    grid.position.y = 0.012;
    scene.add(grid);

    if (isOutdoor) {
      addOutdoor(scene, phase);
    } else {
      addInterior(scene);
    }

    const textureLoader = new THREE.TextureLoader();
    const isSleepingScene = phase === "upstairs" || (phase === "living" && !calledDogs);
    const walkingBackScene = ["walk", "pull", "run", "car", "barkingDog", "boss", "cat", "catFood", "home", "enterHome"].includes(phase);
    const rubySrc = isSleepingScene ? dog.ruby.sleep : walkingBackScene ? dog.ruby.back : phase === "excited" ? dog.ruby.hop : dog.ruby.call;
    const gamjaSrc = isSleepingScene ? dog.gamja.sleep : phase === "poop" ? dog.gamja.poop : walkingBackScene ? dog.gamja.back : phase === "excited" || phase === "gate" ? dog.gamja.hop : dog.gamja.call;
    const rubyMap = textureLoader.load(rubySrc);
    const gamjaMap = textureLoader.load(gamjaSrc);
    const rubySitMap = textureLoader.load(dog.ruby.sit);
    const gamjaSitMap = textureLoader.load(dog.gamja.sit);
    const rubyGateSitMap = textureLoader.load(dog.ruby.gateSit);
    const gamjaGateQuietMap = textureLoader.load(dog.gamja.gateQuiet);
    const ruby = makeDogBillboard(rubyMap, isSleepingScene ? 2.6 : 1.55, isSleepingScene ? 1.25 : 2.15);
    ruby.position.set(isSleepingScene ? -1.2 : -1.0, isSleepingScene ? 0.55 : 1.08, isSleepingScene ? -4.2 : -1.6);
    const gamjaWidth = isSleepingScene ? 2.08 : phase === "poop" ? 2.28 : 1.24;
    const gamjaHeight = isSleepingScene ? 1.0 : phase === "poop" ? 2.98 : 1.72;
    const gamja = makeDogBillboard(gamjaMap, gamjaWidth, gamjaHeight);
    gamja.position.set(
      isSleepingScene ? 1.05 : phase === "poop" ? 0.72 : 1.0,
      isSleepingScene ? 0.48 : phase === "poop" ? 1.42 : 0.86,
      isSleepingScene ? -3.95 : phase === "poop" ? -1.34 : -1.25
    );
    const dogGroup = new THREE.Group();
    dogGroup.add(ruby, gamja);
    const rubyPaws = makeWalkPaws(1);
    const gamjaPaws = makeWalkPaws(0.82);
    dogGroup.add(rubyPaws, gamjaPaws);
    const poopPile = makePoopPile();
    poopPile.position.set(phase === "poop" ? 2.26 : 1.02, 0.08, phase === "poop" ? -3.82 : -1.72);
    poopPile.visible = phase === "poop";
    dogGroup.add(poopPile);
    dogGroup.visible = phase !== "leashMission";
    scene.add(dogGroup);

    const shelf = makeShelf();
    shelf.position.set(4.6, 1.05, -2.6);
    shelf.visible = ["leashPrep", "leashMission", "poopBag"].includes(phase);
    scene.add(shelf);

    const car = makeParkCar();
    car.visible = phase === "car";
    car.position.set(0.7, 0.42, -10.5);
    scene.add(car);

    const otherDog = makeOtherDog();
    otherDog.visible = false;
    otherDog.position.set(phase === "boss" ? 0.9 : 3.9, 0.45, phase === "boss" ? -3.6 : -5.2);
    scene.add(otherDog);

    const clock = new THREE.Clock();
    let frame = 0;
    const movementKeys = ["KeyW", "KeyA", "KeyS", "KeyD"];
    const stopStepAudio = () => {
      const audio = stepAudioRef.current;
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      stepAudioRef.current = null;
    };
    const syncStepAudio = () => {
      if (phase !== "upstairs" || keysRef.current.size === 0) {
        stopStepAudio();
        return;
      }
      if (stepAudioRef.current) return;

      const audio = new Audio(animal.walkingStepsAudio);
      audio.loop = true;
      audio.volume = 0.62;
      stepAudioRef.current = audio;
      void audio.play().catch(() => {
        stopStepAudio();
      });
    };
    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.04);
      const pos = positionRef.current;
      const speed = 3.4 * delta;
      const movingForward = !movementLocked && keysRef.current.has("KeyW");
      if (!movementLocked && keysRef.current.has("KeyA")) pos.x -= speed;
      if (!movementLocked && keysRef.current.has("KeyD")) pos.x += speed;
      if (movingForward) {
        pos.z -= speed;
        if (phase === "walk") onWalkForward?.(delta);
      }
      if (!movementLocked && keysRef.current.has("KeyS")) pos.z += speed;
      pos.x = THREE.MathUtils.clamp(pos.x, -6.2, 6.2);
      const minZ = isOutdoor && !["garden", "gate"].includes(phase) ? -58 : -10.5;
      pos.z = THREE.MathUtils.clamp(pos.z, minZ, 8.5);
      if (phase === "upstairs") {
        const stairCenterX = -3.6;
        const stairHalfWidth = 1.35;
        pos.x = THREE.MathUtils.clamp(pos.x, stairCenterX - stairHalfWidth, stairCenterX + stairHalfWidth);
        pos.z = THREE.MathUtils.clamp(pos.z, -2.95, 8.2);
      }
      if (["leashPrep", "leashMission", "poopBag"].includes(phase)) {
        pos.x = THREE.MathUtils.clamp(pos.x, -5.35, 5.35);
        pos.z = THREE.MathUtils.clamp(pos.z, -6.35, 7.6);
      }
      if (phase === "gate") {
        pos.x = THREE.MathUtils.clamp(pos.x, -2.4, 2.4);
        pos.z = THREE.MathUtils.clamp(pos.z, -5.65, 6.2);
      }

      if (phase === "upstairs" && !reachedEntryRef.current && pos.z < -2.8) {
        reachedEntryRef.current = true;
        onReachLiving?.();
      }

      if (phase === "excited" && canReachEntry && !reachedEntryRef.current && (pos.z < -6.6 || pos.x > 4.8)) {
        reachedEntryRef.current = true;
        onReachEntry?.();
      }

      if (phase === "garden" && !reachedEntryRef.current && pos.z < -5.15) {
        reachedEntryRef.current = true;
        onReachGate?.();
      }

      const stairCameraY = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(pos.z, 8.2, -2.8, 2.35, 1.52), 1.52, 2.35);
      camera.position.set(pos.x, phase === "upstairs" ? stairCameraY : 1.55, pos.z);
      camera.rotation.set(phase === "upstairs" ? -0.18 : 0, pos.yaw, 0);
      camera.fov = phase === "pull" || phase === "run" ? 72 + Math.sin(clock.elapsedTime * 13) * 1.8 : 64;
      camera.updateProjectionMatrix();
      ruby.lookAt(camera.position);
      gamja.lookAt(camera.position);
      const rubyMaterial = ruby.material as THREE.MeshBasicMaterial;
      const gamjaMaterial = gamja.material as THREE.MeshBasicMaterial;
      if (phase === "gate" && rubyCalmRef.current && rubyMaterial.map !== rubyGateSitMap) {
        rubyMaterial.map = rubyGateSitMap;
        rubyMaterial.needsUpdate = true;
      }
      if (phase === "gate" && gamjaQuietRef.current && gamjaMaterial.map !== gamjaGateQuietMap) {
        gamjaMaterial.map = gamjaGateQuietMap;
        gamjaMaterial.needsUpdate = true;
      }
      if (phase === "gate") {
        dogGroup.position.x = 0;
        dogGroup.position.z = -4.62;
        ruby.position.x = -0.78 + (rubyCalmRef.current ? 0 : Math.sin(clock.elapsedTime * 7) * 0.18);
        ruby.rotation.z = rubyCalmRef.current ? 0 : Math.sin(clock.elapsedTime * 7) * 0.18;
        gamja.position.x = 0.72;
        gamja.position.y = gamjaQuietRef.current ? 0.86 : 0.86 + Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.22;
      }
      if ((phase === "living" && calledDogs) || phase === "excited" || phase === "leashPrep") {
        dogGroup.position.x = pos.x;
        dogGroup.position.z = pos.z - 1.2;
      }
      if (isOutdoor && phase !== "gate") {
        dogGroup.position.x = pos.x;
        dogGroup.position.z = pos.z - 3.4;
      }
      if (phase === "garden") {
        dogGroup.position.z = Math.max(dogGroup.position.z, -5.85);
      }
      if (phase === "pull" || phase === "run") {
        dogGroup.position.z = pos.z - 4.1 - Math.abs(Math.sin(clock.elapsedTime * 8)) * 0.35;
      }
      if (phase === "catFood") {
        const pull = Math.abs(Math.sin(clock.elapsedTime * 7.5));
        dogGroup.position.x = pos.x - 0.82;
        dogGroup.position.z = pos.z - 4.25;
        ruby.position.x = -1.38 - pull * 0.46;
        ruby.position.z = -1.78 - pull * 0.2;
        ruby.rotation.z = -0.2 - pull * 0.16;
        gamja.position.x = 0.78;
        gamja.position.z = -1.2;
      }
      if (phase === "car" && dogsRoadsideRef.current) {
        dogGroup.position.x = 2.75;
        dogGroup.position.z = pos.z - 2.9;
      }
      if (phase === "cat") {
        dogGroup.position.x = pos.x - 1.35;
        dogGroup.position.z = pos.z - 3.05;
        gamja.position.x = 0.55 - Math.abs(Math.sin(clock.elapsedTime * 6.5)) * 0.42;
      }
      const walkLike = ["walk", "pull", "run", "car", "barkingDog", "boss", "cat", "catFood", "home", "enterHome"].includes(phase);
      const autoWalkingPhase = ["pull", "run", "cat", "catFood"].includes(phase);
      const activelyWalking = walkLike && ((!movementLocked && keysRef.current.has("KeyW")) || autoWalkingPhase);
      animateDogWalk(ruby, rubyPaws, clock.elapsedTime, activelyWalking, 0);
      animateDogWalk(gamja, gamjaPaws, clock.elapsedTime, activelyWalking, Math.PI * 0.68);
      if (phase === "car") {
        car.position.x = 0.15;
        car.position.z = -12 + Math.min(clock.elapsedTime * 1.15, 9.8);
      }
      if (phase === "barkingDog") {
        otherDog.position.set(4.2, 0.45, -4.5);
      }
      dogGroup.position.y = ["excited", "leashPrep"].includes(phase) ? Math.sin(clock.elapsedTime * 8) * 0.06 : 0;
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (movementLocked || target?.closest("input, textarea, select, [contenteditable='true']")) {
        keysRef.current.clear();
        stopStepAudio();
        return;
      }
      if (movementKeys.includes(event.code)) {
        event.preventDefault();
        keysRef.current.add(event.code);
        syncStepAudio();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (movementLocked) {
        keysRef.current.clear();
        stopStepAudio();
        return;
      }
      if (movementKeys.includes(event.code)) {
        keysRef.current.delete(event.code);
        syncStepAudio();
      }
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
      stopStepAudio();
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
      rubySitMap.dispose();
      gamjaSitMap.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [calledDogs, canReachEntry, dogsRoadside, isOutdoor, movementLocked, onReachEntry, onReachGate, onReachLiving, onWalkForward, phase]);

  return (
    <div className="three-world" ref={mountRef} aria-label="3D 산책길">
      <div className="move-help">W 앞으로 · S 뒤로 · A 왼쪽 · D 오른쪽</div>
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

function makeWalkPaws(scale: number) {
  const group = new THREE.Group();
  const pawMat = new THREE.MeshBasicMaterial({
    color: "#25170f",
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const pawOffsets = [
    [-0.31, 0.08],
    [0.31, 0.08],
    [-0.24, -0.24],
    [0.24, -0.24],
  ];

  pawOffsets.forEach(([x, z], index) => {
    const paw = new THREE.Mesh(new THREE.CircleGeometry(0.115 * scale, 18), pawMat.clone());
    paw.rotation.x = -Math.PI / 2;
    paw.scale.set(1.35, 0.58, 1);
    paw.position.set(x * scale, 0.028, z * scale);
    paw.userData.stepPhase = index % 2 === 0 ? 0 : Math.PI;
    group.add(paw);
  });

  group.visible = false;
  return group;
}

function animateDogWalk(dogMesh: THREE.Mesh, paws: THREE.Group, time: number, active: boolean, phaseOffset: number) {
  paws.position.set(dogMesh.position.x, 0.02, dogMesh.position.z + 0.24);
  paws.visible = active;

  const stride = time * 9.5 + phaseOffset;
  const baseY = dogMesh.userData.baseY ?? dogMesh.position.y;
  dogMesh.userData.baseY = baseY;
  dogMesh.position.y = baseY + (active ? Math.abs(Math.sin(stride)) * 0.045 : 0);
  dogMesh.rotation.z += active ? Math.sin(stride * 0.5) * 0.002 : 0;

  paws.children.forEach((child, index) => {
    const paw = child as THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
    const stepPhase = (paw.userData.stepPhase as number) ?? 0;
    const pulse = (Math.sin(stride + stepPhase) + 1) / 2;
    paw.material.opacity = active ? 0.12 + pulse * 0.26 : 0;
    paw.position.z = ((index < 2 ? 0.08 : -0.24) + (pulse - 0.5) * 0.22) * paws.scale.z;
    paw.scale.x = 1.15 + pulse * 0.36;
    paw.scale.y = 0.5 + pulse * 0.12;
  });
}

function makePoopPile() {
  const group = new THREE.Group();
  const poopMat = new THREE.MeshStandardMaterial({ color: "#6a3d1f", roughness: 0.72, metalness: 0.02 });
  const highlightMat = new THREE.MeshStandardMaterial({ color: "#8c5a31", roughness: 0.68, metalness: 0.02 });
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 14), poopMat);
  base.scale.set(1.25, 0.52, 0.86);
  base.position.set(0, 0.13, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const top = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 12), highlightMat);
  top.scale.set(0.9, 0.58, 0.76);
  top.position.set(0.04, 0.28, -0.02);
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 28),
    new THREE.MeshBasicMaterial({ color: "#2d1d12", transparent: true, opacity: 0.2 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  group.add(shadow);
  group.scale.setScalar(0.78);
  return group;
}

function addInterior(scene: THREE.Scene) {
  const wallMat = new THREE.MeshStandardMaterial({ color: "#f2e5d5", roughness: 0.75 });
  const woodMat = new THREE.MeshStandardMaterial({ color: "#7a4a2f", roughness: 0.58 });
  const railMat = new THREE.MeshStandardMaterial({ color: "#2d2520", roughness: 0.52, metalness: 0.08 });
  const landingMat = new THREE.MeshStandardMaterial({ color: "#8a5737", roughness: 0.62 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 0.18), wallMat);
  backWall.position.set(0, 2, -8);
  scene.add(backWall);
  const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4, 16), wallMat);
  sideWall.position.set(-7, 2, 0);
  scene.add(sideWall);
  const upperLanding = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.18, 4.3), landingMat);
  upperLanding.position.set(-3.6, 1.28, 7.05);
  upperLanding.castShadow = true;
  upperLanding.receiveShadow = true;
  scene.add(upperLanding);
  const landingLip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 4.05), woodMat);
  landingLip.position.set(-1.52, 1.42, 6.85);
  scene.add(landingLip);
  const upperRail = new THREE.Group();
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 3.9), railMat);
  topRail.position.set(-1.52, 2.32, 6.82);
  upperRail.add(topRail);
  for (let i = 0; i < 9; i += 1) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.82, 0.06), railMat);
    bar.position.set(-1.52, 1.9, 5.12 + i * 0.43);
    upperRail.add(bar);
  }
  scene.add(upperRail);
  const lowerVoid = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.3), new THREE.MeshBasicMaterial({ color: "#f5ebdc", transparent: true, opacity: 0.06 }));
  lowerVoid.rotation.x = -Math.PI / 2;
  lowerVoid.position.set(-3.6, 1.31, 4.0);
  scene.add(lowerVoid);
  for (let i = 0; i < 7; i += 1) {
    const stair = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.18, 0.65), woodMat);
    stair.position.set(-3.6, 0.12 + (6 - i) * 0.18, 4.8 - i * 1.05);
    stair.castShadow = true;
    stair.receiveShadow = true;
    scene.add(stair);
  }
  const doorMat = new THREE.MeshStandardMaterial({ color: "#f1e6d8", roughness: 0.42 });
  const trimMat = new THREE.MeshStandardMaterial({ color: "#b08a62", roughness: 0.48 });
  const knobMat = new THREE.MeshStandardMaterial({ color: "#b89246", roughness: 0.28, metalness: 0.35 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.72, 2.95, 0.18), doorMat);
  door.position.set(5.6, 1.4, -7.88);
  scene.add(door);
  const doorFrame = new THREE.Group();
  [
    { x: 4.66, y: 1.5, sx: 0.12, sy: 3.16 },
    { x: 6.54, y: 1.5, sx: 0.12, sy: 3.16 },
    { x: 5.6, y: 3.08, sx: 2.0, sy: 0.12 },
  ].forEach((part) => {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(part.sx, part.sy, 0.24), trimMat);
    trim.position.set(part.x, part.y, -7.74);
    doorFrame.add(trim);
  });
  scene.add(doorFrame);
  [0.72, 1.62, 2.35].forEach((y, index) => {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.16, index === 1 ? 0.78 : 0.48, 0.045), new THREE.MeshStandardMaterial({ color: "#ead8c5", roughness: 0.5 }));
    panel.position.set(5.6, y, -7.66);
    scene.add(panel);
  });
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 12), knobMat);
  knob.position.set(5.02, 1.38, -7.58);
  scene.add(knob);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 12), knobMat);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(4.88, 1.38, -7.58);
  scene.add(handle);
  const plant = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 8), new THREE.MeshStandardMaterial({ color: "#5f8c52", roughness: 0.9 }));
  plant.position.set(5.7, 0.7, -4.1);
  scene.add(plant);
}

function addOutdoor(scene: THREE.Scene, phase: Phase) {
  const isBeforeGate = phase === "garden" || phase === "gate";
  const pathMat = new THREE.MeshStandardMaterial({ color: "#cfc6b5", roughness: 0.82 });
  const parkPathMat = new THREE.MeshStandardMaterial({ color: "#d3c7b0", roughness: 0.86 });
  const bushMat = new THREE.MeshStandardMaterial({ color: "#4f7c3e", roughness: 0.9 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: "#7a5437", roughness: 0.82 });

  const pathDepth = isBeforeGate ? 36 : 112;
  const path = new THREE.Mesh(new THREE.PlaneGeometry(isBeforeGate ? 3.6 : 4.4, pathDepth), isBeforeGate ? pathMat : parkPathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.025, isBeforeGate ? -4 : -40);
  path.receiveShadow = true;
  scene.add(path);

  if (!isBeforeGate) {
    const edgeMat = new THREE.MeshStandardMaterial({ color: "#a8c987", roughness: 0.92 });
    [-3.45, 3.45].forEach((x) => {
      const grassEdge = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 112), edgeMat);
      grassEdge.rotation.x = -Math.PI / 2;
      grassEdge.position.set(x, 0.03, -40);
      grassEdge.receiveShadow = true;
      scene.add(grassEdge);
    });
    for (let i = 0; i < 54; i += 1) {
      const pebble = new THREE.Mesh(new THREE.CylinderGeometry(0.08 + (i % 3) * 0.025, 0.08, 0.018, 10), new THREE.MeshStandardMaterial({ color: i % 2 ? "#b9ad98" : "#e5dcc8", roughness: 0.9 }));
      pebble.rotation.x = -Math.PI / 2;
      pebble.position.set(Math.sin(i * 1.7) * 1.55, 0.055, 7.2 - i * 1.7);
      scene.add(pebble);
    }
  } else {
    for (let i = 0; i < 10; i += 1) {
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 18), pathMat);
      stone.rotation.y = i * 0.34;
      stone.position.set(Math.sin(i * 0.6) * 0.8, 0.055, 5.5 - i * 1.25);
      stone.receiveShadow = true;
      scene.add(stone);
    }
  }

  if (isBeforeGate) {
    const gateMat = new THREE.MeshStandardMaterial({ color: "#1f2321", roughness: 0.45, metalness: 0.15 });
    const fenceMat = new THREE.MeshStandardMaterial({ color: "#202520", roughness: 0.5, metalness: 0.12 });
    const addFenceRail = (x: number, z: number, width: number) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.08), fenceMat);
      rail.position.set(x, 1.45, z);
      scene.add(rail);
    };
    addFenceRail(-4.9, -6.8, 4.8);
    addFenceRail(4.9, -6.8, 4.8);
    for (let i = -14; i <= 14; i += 1) {
      const x = i * 0.35;
      if (Math.abs(x) < 1.65) continue;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.2, 0.07), fenceMat);
      bar.position.set(x, 1.1, -6.8);
      scene.add(bar);
    }
    for (let i = -3; i <= 3; i += 1) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 0.08), gateMat);
      bar.position.set(i * 0.38, 1.15, -6.8);
      scene.add(bar);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.08, 0.08), gateMat);
    rail.position.set(0, 1.55, -6.8);
    scene.add(rail);
  }

  if (phase === "barkingDog") {
    const house = makeRoadsideHouse();
    house.position.set(4.9, 0, -4.6);
    scene.add(house);
  }

  if (phase === "home" || phase === "enterHome") {
    const home = makeReturnHome(phase === "enterHome");
    home.position.set(0, 0, -6.8);
    scene.add(home);
    const welcomeMat = new THREE.MeshStandardMaterial({ color: "#f4dfb9", roughness: 0.72 });
    const mat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.035, 1.0), welcomeMat);
    mat.position.set(0, 0.06, -3.45);
    scene.add(mat);
  }

  [-5.8, 5.8].forEach((x) => {
    for (let i = 0; i < (isBeforeGate ? 6 : 24); i += 1) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.65 + (i % 2) * 0.18, 16, 10), bushMat);
      bush.position.set(x + Math.sin(i) * 0.45, 0.55, 5.4 - i * 2.2);
      bush.castShadow = true;
      scene.add(bush);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.9, 8), trunkMat);
      trunk.position.set(x + Math.sin(i) * 0.45, 0.35, 5.4 - i * 2.2);
      scene.add(trunk);
    }
  });
}

function makeRoadsideHouse() {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: "#ead8c8", roughness: 0.72 });
  const roofMat = new THREE.MeshStandardMaterial({ color: "#6b3f2a", roughness: 0.65 });
  const fenceMat = new THREE.MeshStandardMaterial({ color: "#f3e5cc", roughness: 0.8 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.55, 1.1), wallMat);
  wall.position.set(0, 0.82, 0);
  group.add(wall);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.55, 0.7, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 1.9, 0);
  group.add(roof);
  for (let i = -3; i <= 3; i += 1) {
    const picket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.72, 0.06), fenceMat);
    picket.position.set(i * 0.35, 0.36, -0.95);
    group.add(picket);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.05), fenceMat);
  rail.position.set(0, 0.5, -0.95);
  group.add(rail);
  group.rotation.y = -0.45;
  return group;
}

function makeReturnHome(openDoor: boolean) {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: "#f5eadc", roughness: 0.68 });
  const sideMat = new THREE.MeshStandardMaterial({ color: "#ead7c3", roughness: 0.72 });
  const roofMat = new THREE.MeshStandardMaterial({ color: "#6d3f2a", roughness: 0.58 });
  const trimMat = new THREE.MeshStandardMaterial({ color: "#fff8ec", roughness: 0.5 });
  const doorMat = new THREE.MeshStandardMaterial({ color: "#8b5a38", roughness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: "#bfe1ef", roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.72 });
  const flowerMat = new THREE.MeshStandardMaterial({ color: "#f28aa5", roughness: 0.82 });
  const leafMat = new THREE.MeshStandardMaterial({ color: "#5f9b4f", roughness: 0.86 });

  const wall = new THREE.Mesh(new THREE.BoxGeometry(5.7, 2.8, 1.25), wallMat);
  wall.position.set(0, 1.42, 0);
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  const sideWing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.35, 1.1), sideMat);
  sideWing.position.set(-3.3, 1.18, 0.1);
  sideWing.castShadow = true;
  group.add(sideWing);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.15, 1.05, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.42;
  roof.position.set(-0.25, 3.18, 0);
  roof.castShadow = true;
  group.add(roof);

  const porch = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 1.08), new THREE.MeshStandardMaterial({ color: "#d7c2a1", roughness: 0.78 }));
  porch.position.set(0, 0.12, -0.82);
  porch.receiveShadow = true;
  group.add(porch);

  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.08, 0.12), trimMat);
  doorFrame.position.set(0, 1.18, -0.69);
  group.add(doorFrame);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.82, 0.09), doorMat);
  door.position.set(openDoor ? -0.42 : 0, 1.09, openDoor ? -0.9 : -0.76);
  door.rotation.y = openDoor ? -0.82 : 0;
  door.castShadow = true;
  group.add(door);

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 10), new THREE.MeshStandardMaterial({ color: "#d9b36a", roughness: 0.28, metalness: 0.35 }));
  knob.position.set(openDoor ? -0.72 : 0.32, 1.08, openDoor ? -0.88 : -0.83);
  group.add(knob);

  [-1.85, 1.85].forEach((x) => {
    const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.86, 0.1), trimMat);
    windowFrame.position.set(x, 1.55, -0.7);
    group.add(windowFrame);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.62, 0.08), glassMat);
    glass.position.set(x, 1.55, -0.76);
    group.add(glass);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.66, 0.09), trimMat);
    crossV.position.set(x, 1.55, -0.82);
    group.add(crossV);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.05, 0.09), trimMat);
    crossH.position.set(x, 1.55, -0.82);
    group.add(crossH);
  });

  [-1.65, 1.65].forEach((x) => {
    const planter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 0.34), new THREE.MeshStandardMaterial({ color: "#a97950", roughness: 0.82 }));
    planter.position.set(x, 0.36, -0.92);
    group.add(planter);
    for (let i = 0; i < 5; i += 1) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), i % 2 ? flowerMat : leafMat);
      leaf.position.set(x - 0.42 + i * 0.2, 0.58 + (i % 2) * 0.08, -1.02);
      group.add(leaf);
    }
  });

  const lampMat = new THREE.MeshStandardMaterial({ color: "#ffe1a0", roughness: 0.2, emissive: "#ffd27a", emissiveIntensity: openDoor ? 0.75 : 0.42 });
  [-0.86, 0.86].forEach((x) => {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 10), lampMat);
    lamp.position.set(x, 2.02, -0.86);
    group.add(lamp);
  });

  const pathMat = new THREE.MeshStandardMaterial({ color: "#d9ceb8", roughness: 0.82 });
  for (let i = 0; i < 4; i += 1) {
    const step = new THREE.Mesh(new THREE.CylinderGeometry(0.5 + i * 0.08, 0.5 + i * 0.08, 0.035, 24), pathMat);
    step.rotation.y = i * 0.34;
    step.position.set(Math.sin(i * 0.6) * 0.22, 0.08, -1.55 - i * 0.72);
    group.add(step);
  }

  if (openDoor) {
    const glow = new THREE.PointLight("#ffe6bd", 1.15, 5);
    glow.position.set(0, 1.35, -1.25);
    group.add(glow);
  }

  return group;
}

function makeParkCar() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: "#384e64", roughness: 0.35, metalness: 0.2 });
  const glassMat = new THREE.MeshStandardMaterial({ color: "#a8d4e8", roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.78 });
  const tireMat = new THREE.MeshStandardMaterial({ color: "#161615", roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.65, 1.25), bodyMat);
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.55, 1.0), glassMat);
  cabin.position.set(-0.15, 0.5, 0);
  group.add(cabin);
  [[-0.78, -0.68], [0.78, -0.68], [-0.78, 0.68], [0.78, 0.68]].forEach(([x, z]) => {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.18, 18), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(x, -0.24, z);
    group.add(tire);
  });
  group.rotation.y = Math.PI / 2;
  return group;
}

function makeOtherDog() {
  const group = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: "#8a5a35", roughness: 0.82 });
  const dark = new THREE.MeshStandardMaterial({ color: "#3f2819", roughness: 0.82 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.85, 8, 16), fur);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 14), fur);
  head.position.set(0.62, 0.16, 0);
  group.add(head);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), dark);
  snout.position.set(0.9, 0.14, 0);
  group.add(snout);
  [-0.32, -0.1, 0.14, 0.36].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.34, 5, 8), dark);
    leg.position.set(x, -0.34, 0.22);
    group.add(leg);
    const legBack = leg.clone();
    legBack.position.z = -0.22;
    group.add(legBack);
  });
  group.rotation.y = -0.35;
  return group;
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
  const gamjaBarking = phase === "gate" && !gamjaQuiet;
  return (
    <div className={`dogs dogs-${pose} phase-${phase} ${rubySpinning ? "dogs-spin" : ""}`}>
      <DogSprite src={rubySrc} name="루비" side="left" hearts={hearts} spinning={rubySpinning} />
      <DogSprite src={peePulse ? dog.gamja.pee : gamjaSrc} name="감자" side="right" hearts={hearts} />
      {gamjaBarking && <span className="bark-bubble">{"?! ?!"}</span>}
      {peePulse && <div className="pee-mark" aria-hidden="true" />}
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
        .phase-catFood :global(.left) {
          animation: rubyFoodLunge 0.32s ease-in-out infinite alternate;
        }
        .phase-catFood :global(.right) {
          transform: translateX(22px) scale(0.96);
        }
        .phase-catFood::before {
          content: "";
          position: absolute;
          z-index: 1;
          left: clamp(10px, 7vw, 86px);
          bottom: clamp(190px, 25vw, 278px);
          width: clamp(210px, 29vw, 360px);
          height: 5px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(220, 118, 139, 0.95), rgba(91, 64, 47, 0.58));
          box-shadow: 0 6px 12px rgba(48, 30, 24, 0.22);
          transform: rotate(-13deg);
          transform-origin: left center;
          animation: leashTension 0.32s ease-in-out infinite alternate;
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
        @keyframes rubyFoodLunge {
          from { transform: translate(-56px, 10px) rotate(-8deg) scale(1.04); }
          to { transform: translate(-148px, 24px) rotate(-18deg) scale(1.1); }
        }
        @keyframes leashTension {
          from { transform: rotate(-12deg) scaleX(0.88); opacity: 0.72; }
          to { transform: rotate(-16deg) scaleX(1.06); opacity: 1; }
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
          width: clamp(128px, 18.4vw, 200px);
          height: clamp(152px, 24vw, 256px);
        }
        .phase-living .sprite.right {
          width: clamp(128px, 18.4vw, 200px);
          height: clamp(152px, 24vw, 256px);
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
      {["walk", "pull", "poop", "run", "car", "barkingDog", "boss", "cat"].includes(phase) && <div className="road-perspective" />}
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
          left: 50%;
          bottom: -46%;
          width: min(760px, 112vw);
          height: 112%;
          border-radius: 48% 48% 0 0;
          background:
            repeating-linear-gradient(90deg, transparent 0 46%, rgba(255,255,255,0.28) 46% 47.5%, transparent 47.5% 52.5%, rgba(255,255,255,0.28) 52.5% 54%, transparent 54% 100%),
            repeating-linear-gradient(180deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 72px),
            linear-gradient(180deg, rgba(227, 218, 197, 0.96), rgba(151, 134, 103, 0.98));
          box-shadow: 0 -28px 70px rgba(45, 80, 38, 0.22);
          transform: translateX(-50%) perspective(540px) rotateX(66deg);
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
  poopStep: PoopStep;
  carStopped: boolean;
  dogsRoadside: boolean;
  bossLane: Lane;
  bossBlocks: number;
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
  setPoopStep: (step: PoopStep) => void;
  choosePoopTool: (tool: PoopTool) => void;
  dropPoopTool: (tool?: PoopTool) => void;
  setCarStopped: (value: boolean) => void;
  setDogsRoadside: (value: boolean) => void;
  finishCar: () => void;
  ignoreDog: () => void;
  blockBoss: () => void;
  clickBossDog: () => void;
  carGuide: boolean;
  showSuccessToast: (mission?: string) => void;
}) {
  const p = props;
  if (p.phase === "intro") {
    return <CenterCard title={"루비 감자와 산책하기"} button="산책 START" onClick={p.start} image={dog.intro} variant="intro" />;
  }
  if (p.phase === "pull") return <PullWarning timeLeft={p.timeLeft} />;
  if (p.phase === "barkingDog") return <NeighborBarkDog />;
  if (p.phase === "boss") return <BossClickGame lane={p.bossLane} blocks={p.bossBlocks} timeLeft={p.timeLeft} clickBossDog={p.clickBossDog} />;
  if (p.phase === "cat") return <CatChaseLayer timeLeft={p.timeLeft} />;
  if (p.phase === "catFood") return <CatFoodLayer timeLeft={p.timeLeft} />;
  if (["upstairs", "living", "excited", "garden"].includes(p.phase)) return null;
  if (p.phase === "leashPrep") return <GearShelf rubyLeashed={p.rubyLeashed} gamjaLeashed={p.gamjaLeashed} hasPoopBag={p.hasPoopBag} side />;
  if (p.phase === "leashMission") {
    return <><GearShelf rubyLeashed={p.rubyLeashed} gamjaLeashed={p.gamjaLeashed} hasPoopBag={p.hasPoopBag} side /><LeashTargets rubyLeashed={p.rubyLeashed} gamjaLeashed={p.gamjaLeashed} finish={p.finishLeash} /></>;
  }
  if (p.phase === "leashZoom" && p.zoomDog) return <LeashZoom dogKey={p.zoomDog} finish={p.finishLeash} />;
  if (p.phase === "poopBag") return <PoopBagDock hasPoopBag={p.hasPoopBag} setHasPoopBag={p.setHasPoopBag} setMessage={p.setMessage} goOut={p.goOut} />;
  if (p.phase === "gate") {
    return (
      <ActionDock>
        <button className={p.rubyCalm ? "gate-action sit done" : "gate-action sit"} onClick={() => { playSound("success"); p.setRubyCalm(true); p.setMessage("루비가 빙글빙글 돌다가 앉았어요."); }}>{"앉아"}</button>
        <button className={p.gamjaQuiet ? "gate-action hush done" : "gate-action hush"} onClick={() => { playSound("success"); p.setGamjaQuiet(true); p.setMessage("감자가 짖음을 멈추고 차분해졌어요."); }}>{"조용히 해"}</button>
        <button className="gate-action open" onClick={p.openGate}>{"대문 열기"}</button>
      </ActionDock>
    );
  }
  if (p.phase === "poop") return <PoopTools hasPoopBag={p.hasPoopBag} tool={p.poopTool} step={p.poopStep} setStep={p.setPoopStep} setMessage={p.setMessage} choose={p.choosePoopTool} drop={p.dropPoopTool} />;
  if (p.phase === "run") return <ActionDock><span className="counter">Space {p.runTaps}/18</span></ActionDock>;
  if (p.phase === "car") return <CarSafetyDock carGuide={p.carGuide} carStopped={p.carStopped} dogsRoadside={p.dogsRoadside} setDogsRoadside={p.setDogsRoadside} setMessage={p.setMessage} />;
  if (p.phase === "home") {
    return <ActionDock><button onClick={() => { p.setPhase("enterHome"); p.setMessage("현관문이 열렸어요. 루비와 감자가 먼저 집으로 쏙 들어가요."); }}>{"집 안으로 들어가기"}</button></ActionDock>;
  }
  if (p.phase === "enterHome") return <ActionDock><span className="counter">집으로 들어가는 중...</span></ActionDock>;
  if (p.phase === "clear") return <CenterCard title="산책 완료!" body="산책 완료! 루비와 감자가 행복해 보여요." button="다시 하기" onClick={p.reset} image={dog.duo} />;
  if (p.phase === "fail") return <CenterCard title="산책 실패..." body="다시 도전해볼까요?" button="Restart" onClick={p.reset} image={dog.duo} />;
  return null;
}

function CarSafetyDock({
  carGuide,
  carStopped,
  dogsRoadside,
  setDogsRoadside,
  setMessage,
}: {
  carGuide: boolean;
  carStopped: boolean;
  dogsRoadside: boolean;
  setDogsRoadside: (value: boolean) => void;
  setMessage: (message: string) => void;
}) {
  const dropDogs = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (carGuide) {
      setMessage("\uC548\uB0B4\uAC00 \uB05D\uB09C \uB4A4 \uC62E\uACA8\uC8FC\uC138\uC694. \uCC28\uAC00 \uB2E4\uAC00\uC624\uACE0 \uC788\uC5B4\uC694.");
      return;
    }
    if (!carStopped) {
      setMessage("\uBA3C\uC800 \uBA48\uCDB0\uB77C\uACE0 \uC785\uB825\uD574\uC57C \uD574\uC694!");
      return;
    }
    setDogsRoadside(true);
    setMessage("\uB8E8\uBE44\uC640 \uAC10\uC790\uB97C \uD480 \uCABD\uC73C\uB85C \uC62E\uACBC\uC5B4\uC694. \uC774\uC81C \uAE30\uB2E4\uB824\uB77C\uACE0 \uC785\uB825\uD558\uC138\uC694.");
  };

  return (
    <div className="car-safety-ui">
      {carGuide && (
        <div className="car-guide">
          <b>{"\uCC28\uAC00 \uC6B0\uB9AC \uC55E\uC73C\uB85C \uC624\uACE0 \uC788\uC5B4\uC694!"}</b>
          <span><strong>{"\uBA48\uCDB0"}</strong>{" \uC785\uB825 \uD6C4 \uB8E8\uBE44\uC640 \uAC10\uC790\uB97C \uD480\uCABD\uC73C\uB85C \uC62E\uAE30\uACE0 "}<strong>{"\uAE30\uB2E4\uB824"}</strong>{"\uB97C \uC785\uB825\uD558\uC138\uC694."}</span>
        </div>
      )}
      <div className={dogsRoadside ? "roadside-grass done" : "roadside-grass"} onDragOver={(event) => event.preventDefault()} onDrop={dropDogs}>
        <span>{dogsRoadside ? "\uC548\uC804 \uC9C0\uB300" : "\uD480\uCABD"}</span>
      </div>
      <div
        className={dogsRoadside ? "roadside-drag-source moved" : "roadside-drag-source"}
        draggable={!carGuide}
        aria-label="\uB8E8\uBE44\uC640 \uAC10\uC790 \uC62E\uAE30\uAE30"
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", "dogs-roadside");
        }}
      />
      <style jsx>{`
        .car-safety-ui { position: absolute; z-index: 22; inset: 0; pointer-events: none; }
        .car-guide { position: absolute; left: 50%; top: 16%; transform: translateX(-50%); display: grid; gap: 8px; min-width: min(480px, calc(100vw - 56px)); padding: 18px 22px; border-radius: 24px; text-align: center; color: #683034; background: linear-gradient(180deg, rgba(255,226,226,0.97), rgba(255,198,205,0.95)); border: 2px solid rgba(210, 105, 118, 0.38); box-shadow: 0 24px 54px rgba(94,42,44,0.28); font-weight: 950; }
        .car-guide b { font-size: clamp(1.08rem, 2.2vw, 1.5rem); }
        .car-guide strong { display: inline-block; margin: 0 3px; padding: 2px 10px 4px; border-radius: 999px; color: #bd2e3a; background: #fff8eb; box-shadow: 0 8px 18px rgba(156, 55, 65, 0.18); }
        .roadside-grass { position: absolute; right: 26px; top: 31%; width: 142px; height: 170px; border-radius: 28px; display: grid; place-items: center; font-weight: 950; color: #fffde9; border: 2px dashed rgba(255,255,255,0.78); background: radial-gradient(circle at 28% 35%, rgba(255,255,255,0.22), transparent 26%), linear-gradient(135deg, rgba(67, 132, 58, 0.82), rgba(133, 184, 92, 0.86)); box-shadow: 0 18px 40px rgba(23, 77, 36, 0.22); pointer-events: auto; }
        .roadside-grass.done { border-style: solid; background: linear-gradient(135deg, rgba(62, 136, 54, 0.92), rgba(112, 184, 81, 0.92)); }
        .roadside-drag-source { position: absolute; left: 50%; bottom: 86px; width: 250px; height: 190px; transform: translateX(-50%); cursor: grab; pointer-events: auto; border-radius: 44px; background: transparent; }
        .roadside-drag-source.moved { display: none; }
      `}</style>
    </div>
  );
}
function PullWarning({ timeLeft }: { timeLeft: number | null }) {
  return (
    <div className="pull-warning">
      <b>루비가 줄을 당겨요!</b>
      <span><strong>천천히</strong>라고 입력해 주세요.</span>
      {timeLeft !== null && <small>{timeLeft}s</small>}
      <style jsx>{`
        .pull-warning {
          position: absolute;
          z-index: 25;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          display: grid;
          gap: 8px;
          min-width: min(430px, calc(100vw - 56px));
          padding: 20px 24px;
          border-radius: 24px;
          text-align: center;
          color: #683034;
          background: linear-gradient(180deg, rgba(255, 226, 226, 0.96), rgba(255, 198, 205, 0.94));
          border: 2px solid rgba(210, 105, 118, 0.36);
          box-shadow: 0 24px 54px rgba(94, 42, 44, 0.28);
          pointer-events: none;
        }
        b { font-size: clamp(1.1rem, 2.2vw, 1.55rem); }
        strong { display: inline-block; padding: 2px 10px 4px; border-radius: 999px; background: #fff9ec; color: #bf333e; font-size: 1.18em; box-shadow: 0 8px 18px rgba(156, 55, 65, 0.18); }
        small { font-weight: 950; color: #a73d45; }
      `}</style>
    </div>
  );
}

function NeighborBarkDog() {
  useEffect(() => {
    const audio = new Audio(animal.neighborBarkAudio);
    audio.loop = true;
    audio.volume = 0.72;
    void audio.play().catch(() => {
      playSound("bark");
    });
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  return (
    <div className="neighbor-event">
      <div className="neighbor-guide">
        <b>옆집 강아지가 짖고 있어요!</b>
        <span>5초 안에 <strong>무시해</strong>를 입력하세요.</span>
      </div>
      <div className="neighbor-yard">
        <span className="house-label">옆집 정원</span>
        <Image src={animal.neighborDog} alt="짖는 옆집 강아지" width={150} height={210} priority />
        <span className="bark-bubble">멍! 멍!</span>
      </div>
      <style jsx>{`
        .neighbor-event { position: absolute; z-index: 23; inset: 0; pointer-events: none; }
        .neighbor-guide {
          position: absolute;
          left: 50%;
          top: 16%;
          transform: translateX(-50%);
          display: grid;
          gap: 7px;
          min-width: min(430px, calc(100vw - 56px));
          padding: 16px 20px;
          border-radius: 22px;
          text-align: center;
          color: #683034;
          background: linear-gradient(180deg, rgba(255,226,226,0.97), rgba(255,198,205,0.94));
          border: 2px solid rgba(210, 105, 118, 0.36);
          box-shadow: 0 20px 44px rgba(94,42,44,0.25);
          font-weight: 950;
        }
        .neighbor-guide strong { display: inline-block; padding: 2px 9px 4px; border-radius: 999px; color: #bd2e3a; background: #fff8eb; }
        .neighbor-yard {
          position: absolute;
          right: clamp(36px, 9vw, 130px);
          bottom: 104px;
          width: clamp(190px, 22vw, 300px);
          height: clamp(220px, 28vw, 360px);
          border-radius: 28px 28px 8px 8px;
          background: linear-gradient(180deg, rgba(247,239,215,0.62), rgba(73,109,57,0.48));
          border: 2px solid rgba(255,255,255,0.42);
          box-shadow: inset 0 -32px 0 rgba(54,91,45,0.32), 0 24px 46px rgba(0,0,0,0.24);
        }
        .neighbor-yard :global(img) { position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); object-fit: contain; filter: drop-shadow(0 18px 18px rgba(0,0,0,0.32)); }
        .house-label, .bark-bubble { position: absolute; padding: 8px 11px; border-radius: 999px; background: #fff8e8; font-weight: 950; box-shadow: 0 10px 22px rgba(0,0,0,0.18); }
        .house-label { left: 12px; top: 12px; font-size: 0.85rem; }
        .bark-bubble { right: 12px; top: 54px; color: #b64339; animation: bark-pop 0.55s ease-in-out infinite alternate; }
        @keyframes bark-pop { from { transform: scale(0.94); } to { transform: scale(1.08); } }
      `}</style>
    </div>
  );
}

function BossClickGame({
  lane,
  blocks,
  timeLeft,
  clickBossDog,
}: {
  lane: Lane;
  blocks: number;
  timeLeft: number | null;
  clickBossDog: () => void;
}) {
  const laneClass = `lane-${lane}`;
  const guideMode = blocks < 0;
  const introCopy =
    blocks === -4
      ? { title: "멀리서 으르렁... 짖는 소리가 들려요", body: "아직 모습은 보이지 않지만 공기가 갑자기 조용해졌어요." }
      : blocks === -3
        ? { title: "루비 귀 쫑긋!", body: "루비가 발걸음을 멈추고 소리 나는 쪽을 바라봐요." }
        : blocks === -2
          ? { title: "감자가 긴장했어요", body: "감자가 몸을 낮추고 루비 옆에 바짝 붙었어요." }
          : { title: "화면이 흔들려요!", body: "사나운 강아지가 튀어나오면 3초 안에 직접 클릭해서 블로킹하세요." };

  useEffect(() => {
    const audio = new Audio(animal.bossDogAudio);
    audio.loop = true;
    audio.volume = 0.78;
    void audio.play().catch(() => {
      playSound("bark");
    });
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  return (
    <div className={`boss-event ${blocks === -1 ? "shake" : ""}`}>
      {!guideMode && (
        <button className={`boss-dog ${laneClass}`} onClick={clickBossDog} aria-label="\uC0AC\uB098\uC6B4 \uAC15\uC544\uC9C0 \uD074\uB9AD">
          <Image src={animal.bossDog} alt="\uC0AC\uB098\uC6B4 \uAC15\uC544\uC9C0" fill sizes="260px" priority />
        </button>
      )}
      {guideMode && (
        <div className={`boss-omen omen-${Math.abs(blocks)}`}>
          <span className="sound-wave" />
          {blocks <= -3 && <span className="ear-alert">루비 귀 쫑긋</span>}
          {blocks <= -2 && <span className="tense-alert">감자 긴장</span>}
        </div>
      )}
      <div className="boss-warning">
        {guideMode ? (
          <>
            <b>{introCopy.title}</b>
            <span>{introCopy.body}</span>
          </>
        ) : (
          <>
      <b>{"\uC0AC\uB098\uC6B4 \uAC15\uC544\uC9C0\uAC00 \uB098\uD0C0\uB0A0 \uAC70\uC608\uC694!"}</b>
            <span>{blocks}/3 {"\uBE14\uB85C\uD0B9"}{timeLeft !== null ? ` · ${timeLeft}s` : ""}</span>
          </>
        )}
      </div>
      <style jsx>{`
        .boss-event { position: absolute; z-index: 25; inset: 0; pointer-events: none; }
        .boss-event.shake { animation: boss-screen-shake 0.18s linear infinite; }
        .boss-omen {
          position: absolute;
          left: 50%;
          bottom: 168px;
          width: min(520px, 72vw);
          height: 220px;
          transform: translateX(-50%);
          pointer-events: none;
        }
        .sound-wave {
          position: absolute;
          left: 50%;
          bottom: 24px;
          width: 88px;
          height: 88px;
          transform: translateX(-50%);
          border: 4px solid rgba(178, 55, 66, 0.36);
          border-radius: 50%;
          box-shadow: 0 0 0 24px rgba(178, 55, 66, 0.12), 0 0 0 52px rgba(178, 55, 66, 0.07);
          animation: omen-pulse 0.9s ease-out infinite;
        }
        .ear-alert,
        .tense-alert {
          position: absolute;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255, 248, 235, 0.94);
          border: 2px solid rgba(150, 95, 65, 0.2);
          color: #603225;
          font-weight: 950;
          box-shadow: 0 12px 22px rgba(0, 0, 0, 0.18);
          animation: omen-pop 0.4s ease-out both;
        }
        .ear-alert { left: 12%; top: 28px; }
        .tense-alert { right: 10%; top: 78px; }
        .boss-dog {
          position: absolute;
          bottom: 120px;
          width: clamp(170px, 20vw, 260px);
          height: clamp(150px, 19vw, 240px);
          border: 0;
          background: transparent;
          filter: drop-shadow(0 24px 22px rgba(0,0,0,0.32));
          cursor: pointer;
          pointer-events: auto;
          animation: boss-run 0.42s ease-in-out infinite alternate;
        }
        .boss-dog :global(img) { object-fit: contain; }
        .lane-left { left: 15%; }
        .lane-center { left: 50%; transform: translateX(-50%); }
        .lane-right { right: 15%; }
        .boss-warning {
          position: absolute;
          left: 50%;
          top: 17%;
          transform: translateX(-50%);
          display: grid;
          gap: 6px;
          min-width: min(460px, calc(100vw - 54px));
          padding: 16px 20px;
          border-radius: 22px;
          text-align: center;
          color: #683034;
          background: linear-gradient(180deg, rgba(255,226,226,0.97), rgba(255,198,205,0.94));
          border: 2px solid rgba(210, 105, 118, 0.36);
          box-shadow: 0 20px 44px rgba(94,42,44,0.25);
          font-weight: 950;
        }
        strong { display: inline-block; padding: 2px 9px 4px; border-radius: 999px; color: #bd2e3a; background: #fff8eb; }
        @keyframes boss-run {
          from { translate: 0 8px; scale: 0.96; }
          to { translate: 0 -4px; scale: 1.02; }
        }
        @keyframes omen-pulse {
          from { opacity: 0.9; transform: translateX(-50%) scale(0.78); }
          to { opacity: 0.18; transform: translateX(-50%) scale(1.28); }
        }
        @keyframes omen-pop {
          from { opacity: 0; transform: translateY(10px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes boss-screen-shake {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(5px, -3px); }
          50% { transform: translate(-4px, 4px); }
          75% { transform: translate(3px, 3px); }
        }
      `}</style>
    </div>
  );
}
function CatChaseLayer({ timeLeft }: { timeLeft: number | null }) {
  return (
    <div className="cat-event">
      <Image src={animal.cat} alt="왼쪽에 나타난 고양이" width={190} height={120} priority />
      <div className="cat-warning">
        <b>감자가 고양이를 쫓으려 해요!</b>
        <span><strong>안돼</strong> 라고 입력하세요{timeLeft !== null ? ` · ${timeLeft}s` : ""}</span>
      </div>
      <style jsx>{`
        .cat-event { position: absolute; z-index: 24; inset: 0; pointer-events: none; }
        .cat-event :global(img) {
          position: absolute;
          left: 7%;
          bottom: 152px;
          object-fit: contain;
          filter: drop-shadow(0 15px 16px rgba(0,0,0,0.26));
          animation: cat-step 1.2s ease-in-out infinite alternate;
        }
        .cat-warning {
          position: absolute;
          left: 50%;
          bottom: 118px;
          transform: translateX(-50%);
          min-width: min(440px, calc(100vw - 60px));
          padding: 14px 18px;
          border-radius: 20px;
          text-align: center;
          color: #5a2c2f;
          background: linear-gradient(180deg, rgba(255,229,229,0.97), rgba(255,205,211,0.95));
          border: 2px solid rgba(224, 118, 128, 0.34);
          box-shadow: 0 18px 40px rgba(94,42,44,0.22);
          font-weight: 950;
        }
        strong { color: #bd2e3a; font-size: 1.16em; }
        @keyframes cat-step { from { transform: translateX(-6px); } to { transform: translateX(12px); } }
      `}</style>
    </div>
  );
}

function CatFoodLayer({ timeLeft }: { timeLeft: number | null }) {
  return (
    <div className="cat-food-event">
      <div className="cat-food-zone" aria-hidden="true">
        <div className="food-bowl">
          <span />
          <b>길고양이 밥</b>
        </div>
      </div>
      <div className="cat-food-warning">
        <b>루비가 길고양이 밥 쪽으로 확 끌려가요!</b>
        <span><strong>먹지마</strong> 라고 입력하세요{timeLeft !== null ? ` · ${timeLeft}s` : ""}</span>
      </div>
      <style jsx>{`
        .cat-food-event {
          position: absolute;
          z-index: 24;
          inset: 0;
          pointer-events: none;
        }
        .cat-food-zone {
          position: absolute;
          left: clamp(38px, 13vw, 180px);
          bottom: clamp(238px, 32vh, 330px);
          width: clamp(92px, 10vw, 136px);
          height: 72px;
          border-radius: 24px;
          background:
            radial-gradient(ellipse at 50% 88%, rgba(74, 125, 54, 0.62), transparent 48%),
            radial-gradient(circle at 22% 30%, rgba(255, 244, 205, 0.22), transparent 26%),
            linear-gradient(180deg, rgba(255, 248, 232, 0.12), rgba(79, 122, 66, 0.32));
          box-shadow: inset 0 -16px 0 rgba(46, 99, 50, 0.22), 0 16px 30px rgba(0, 0, 0, 0.16);
        }
        .food-bowl {
          position: absolute;
          left: 50%;
          bottom: 10px;
          transform: translateX(-50%);
          display: grid;
          justify-items: center;
          gap: 5px;
          color: #5b3825;
          font-weight: 950;
          font-size: 0.8rem;
        }
        .food-bowl span {
          width: 54px;
          height: 24px;
          border-radius: 0 0 48px 48px;
          background:
            radial-gradient(ellipse at 48% 18%, #b07a49 0 34%, transparent 36%),
            linear-gradient(180deg, #fff4df 0 28%, #c96f50 29% 100%);
          border: 3px solid rgba(97, 55, 37, 0.34);
          box-shadow: inset 0 -6px 10px rgba(100, 45, 32, 0.28), 0 9px 14px rgba(0,0,0,0.18);
        }
        .cat-food-warning {
          position: absolute;
          left: 50%;
          top: 18%;
          transform: translateX(-50%);
          display: grid;
          gap: 8px;
          min-width: min(480px, calc(100vw - 56px));
          padding: 18px 22px;
          border-radius: 24px;
          text-align: center;
          color: #683034;
          background: linear-gradient(180deg, rgba(255,226,226,0.97), rgba(255,198,205,0.95));
          border: 2px solid rgba(210, 105, 118, 0.38);
          box-shadow: 0 24px 54px rgba(94,42,44,0.28);
          font-weight: 950;
        }
        .cat-food-warning b {
          font-size: clamp(1.08rem, 2.2vw, 1.5rem);
        }
        .cat-food-warning strong {
          display: inline-block;
          margin: 0 3px;
          padding: 2px 10px 4px;
          border-radius: 999px;
          color: #bd2e3a;
          background: #fff8eb;
          box-shadow: 0 8px 18px rgba(156, 55, 65, 0.18);
        }
      `}</style>
    </div>
  );
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
    event.currentTarget.classList.remove("over");
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
        <Image src={dog.ruby.sit} alt="앉은 루비" fill sizes="210px" />
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
        <Image src={dog.gamja.sit} alt="앉은 감자" fill sizes="150px" />
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
          bottom: 54px;
          width: 260px;
          height: 330px;
          border-radius: 28px;
          background: rgba(255, 250, 242, 0.02);
          border: 2px dashed rgba(255, 230, 175, 0.2);
          box-shadow: none;
          overflow: hidden;
          pointer-events: auto;
          transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
        }
        .dog-target.ruby { left: 18%; }
        .dog-target.gamja {
          left: 45%;
          width: 208px;
          height: 264px;
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
          padding: 0 0 22px;
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

function PoopTools({
  hasPoopBag,
  tool,
  step,
  setStep,
  setMessage,
  choose,
  drop,
}: {
  hasPoopBag: boolean;
  tool: PoopTool;
  step: PoopStep;
  setStep: (step: PoopStep) => void;
  setMessage: (message: string) => void;
  choose: (tool: PoopTool) => void;
  drop: (tool?: PoopTool) => void;
}) {
  const [guardVisible, setGuardVisible] = useState(false);
  const [guardNotice, setGuardNotice] = useState<string | null>(null);
  const [flashImage, setFlashImage] = useState<"dirtyHand" | "sockPoop" | null>(null);
  const showGuardNotice = (text: string) => {
    setGuardVisible(true);
    setGuardNotice(text);
    setMessage(text);
    window.setTimeout(() => setGuardNotice(null), 2000);
  };
  const dragTool = (event: ReactDragEvent<HTMLDivElement>, selectedTool: Exclude<PoopTool, null>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", selectedTool);
  };

  const dropOnPoop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dragged = event.dataTransfer.getData("text/plain") as PoopTool;
    const selected = dragged || tool || undefined;
    if (selected === "leaf") {
      setFlashImage("dirtyHand");
      window.setTimeout(() => {
        setFlashImage(null);
        drop(selected);
      }, 2000);
      return;
    }
    if (selected === "sock") {
      setFlashImage("sockPoop");
      window.setTimeout(() => {
        setFlashImage(null);
        drop(selected);
      }, 3000);
      return;
    }
    drop(selected);
  };

  return (
    <div className="poop-ui">
      <div className="poop-hotspot" onDragOver={(event) => event.preventDefault()} onDrop={dropOnPoop}>
        <span className="poop-pile" />
      </div>
      {step === "leafReady" && (
        <div className="leaf-grass">
          <div draggable className="drag-chip image-chip leaf" onDragStart={(event) => dragTool(event, "leaf")}>
            <Image src="/ruby-gamja/custom/leaf-tool.png" alt="나뭇잎" width={56} height={38} />
          </div>
        </div>
      )}
      {guardVisible && (
        <div className="guard-warning">
          <Image src="/ruby-gamja/custom/guard-warning.png" alt="경비 아저씨 경고" fill sizes="260px" />
        </div>
      )}
      {guardNotice && <div className="guard-notice">{guardNotice}</div>}
      {flashImage && (
        <div className="poop-flash">
          <Image
            src={flashImage === "dirtyHand" ? "/ruby-gamja/custom/dirty-hand.png" : "/ruby-gamja/custom/sock-poop.png"}
            alt={flashImage === "dirtyHand" ? "손에 묻음" : "양말로 치움"}
            fill
            sizes="360px"
          />
          {flashImage === "dirtyHand" && (
            <div className="flash-caption">나뭇잎이 너무 작아요! 손에 묻어버렸어요...</div>
          )}
          {flashImage === "sockPoop" && (
            <div className="flash-caption green">양말은 잃었지만 환경은 지켜냈어요!</div>
          )}
        </div>
      )}
      <div className={step === "sockReady" ? "poop-dialog normal" : "poop-dialog danger"}>
        {step === "ask" && (
          <>
            <b>{"주의! 감자가 똥을 쌌어요. 펫티켓을 지키겠습니까?"}</b>
            <div className="poop-actions">
              <button onClick={() => { setStep("bagCheck"); setMessage("가방을 확인해 보세요."); }}>{"네"}</button>
              <button onClick={() => { setStep("bagCheck"); showGuardNotice("그냥 가려다 경비 아저씨한테 걸렸어요! 치워야겠네요.."); }}>{"아니요"}</button>
            </div>
          </>
        )}
        {step === "bagCheck" && (
          <div className="bag-check">
            <button className="bag-button" onClick={() => {
              if (hasPoopBag) {
                choose("bag");
                setMessage("가방에 똥봉투가 있어요. 똥봉투로 똥을 주워주세요.");
              } else {
                setStep("leafAsk");
                setMessage("이런! 똥봉투를 안가져왔네요... 나뭇잎으로라도 치워볼까요?");
              }
            }} aria-label="가방 열기">🎒</button>
            {tool === "bag" && (
              <div draggable className="bag-chip" onDragStart={(event) => dragTool(event, "bag")}>
                <Image src="/ruby-gamja/custom/poop-bag-real.png" alt="poop bag" width={58} height={58} />
              </div>
            )}
          </div>
        )}
        {step === "leafAsk" && (
          <>
            <b>{"이런! 똥봉투를 안가져왔네요..."}</b>
            <span>{"나뭇잎으로라도 치워볼까요?"}</span>
            <div className="poop-actions">
              <button onClick={() => choose("leaf")}>{"네"}</button>
              <button onClick={() => { setStep("sockAsk"); setMessage("어쩔 수 없다... 양말뿐인건가..?"); }}>{"아니요"}</button>
            </div>
          </>
        )}
        {step === "leafReady" && <b>{"풀숲에서 나뭇잎을 찾아 똥을 주워보세요"}</b>}
        {step === "sockAsk" && (
          <>
            <b>{"어쩔 수 없다... 양말뿐인건가..?"}</b>
            <div className="poop-actions">
              <button onClick={() => choose("sock")}>{"양말 벗기"}</button>
              <button onClick={() => { showGuardNotice("그냥 가려다 경비 아저씨한테 또 걸렸어요! 치워야겠네요.."); }} >{"그냥 가자"}</button>
            </div>
          </>
        )}
        {step === "sockReady" && (
          <div className="tool-row">
            <b>{"손에 양말을 들었어요."}</b>
            <div draggable className="drag-chip image-chip sock" onDragStart={(event) => dragTool(event, "sock")}>
              <Image src="/ruby-gamja/custom/sock-tool.png" alt="양말" width={74} height={52} />
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        .poop-ui { position: absolute; z-index: 24; inset: 0; pointer-events: none; }
        .poop-hotspot { position: absolute; left: 65.5%; bottom: 366px; width: 188px; height: 144px; transform: translateX(-50%); display: grid; place-items: center; pointer-events: auto; }
        .poop-pile { display: none; }
        .leaf-grass { position: absolute; right: 82px; bottom: 136px; width: 78px; height: 54px; display: grid; place-items: center; pointer-events: auto; }
        .guard-warning { position: absolute; left: 18px; bottom: 122px; width: min(270px, 34vw); aspect-ratio: 1; filter: drop-shadow(0 16px 24px rgba(48, 28, 18, 0.24)); pointer-events: none; }
        .guard-warning :global(img), .poop-flash :global(img) { object-fit: contain; }
        .guard-notice { position: absolute; z-index: 6; left: 50%; top: 42%; transform: translate(-50%, -50%); width: min(520px, calc(100vw - 56px)); padding: 18px 22px; border-radius: 24px; text-align: center; background: linear-gradient(180deg, rgba(255,226,226,0.98), rgba(255,191,201,0.96)); border: 2px solid rgba(220, 92, 108, 0.38); color: #642b31; font-weight: 950; box-shadow: 0 22px 48px rgba(102, 40, 48, 0.26); pointer-events: none; animation: guard-pop 0.18s ease-out; }
        .poop-flash { position: absolute; left: 50%; top: 46%; width: min(360px, 54vw); aspect-ratio: 1.45; transform: translate(-50%, -50%); z-index: 4; filter: drop-shadow(0 20px 28px rgba(48, 28, 18, 0.28)); pointer-events: none; animation: flash-pop 0.2s ease-out; }
        .flash-caption { position: absolute; left: 50%; bottom: -48px; transform: translateX(-50%); min-width: min(430px, calc(100vw - 64px)); padding: 12px 16px; border-radius: 18px; background: linear-gradient(180deg, rgba(255,226,226,0.98), rgba(255,201,207,0.96)); border: 2px solid rgba(224, 118, 128, 0.34); color: #5a2c2f; font-weight: 950; text-align: center; box-shadow: 0 16px 32px rgba(94,42,44,0.24); }
        .flash-caption.green { background: linear-gradient(180deg, rgba(225,247,218,0.98), rgba(188,229,180,0.96)); border-color: rgba(91,154,86,0.34); color: #2d6332; box-shadow: 0 16px 32px rgba(53,98,49,0.22); }
        .poop-dialog { position: absolute; left: 50%; bottom: 32px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; min-width: min(420px, calc(100vw - 64px)); padding: 16px 18px; border-radius: 18px; box-shadow: 0 16px 38px rgba(0,0,0,0.22); font-weight: 950; pointer-events: auto; }
        .poop-dialog.danger { background: linear-gradient(180deg, rgba(255,229,229,0.97), rgba(255,205,211,0.95)); border: 2px solid rgba(224, 118, 128, 0.34); color: #5a2c2f; }
        .poop-dialog.normal { background: linear-gradient(180deg, rgba(255,250,242,0.96), rgba(246,229,201,0.94)); border: 2px solid rgba(104, 77, 52, 0.2); color: #4b3322; }
        .poop-dialog b { font-size: 1.05rem; }
        .poop-actions, .bag-check, .tool-row { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; }
        .poop-actions button { min-width: 96px; padding: 10px 16px; border-radius: 999px; border: 2px solid rgba(104, 77, 52, 0.34); background: linear-gradient(180deg, #fff7e8, #efd4a5); color: #4b3322; font-weight: 950; box-shadow: 0 8px 18px rgba(65,43,25,0.14); }
        .bag-button { width: 82px; height: 82px; border-radius: 28px; border: 2px solid rgba(104, 77, 52, 0.24); background: linear-gradient(180deg, #fffaf1, #f2dfbd); font-size: 2.4rem; box-shadow: 0 12px 24px rgba(65,43,25,0.16); }
        .bag-chip, .drag-chip { cursor: grab; width: 76px; height: 76px; border-radius: 20px; display: grid; place-items: center; background: rgba(255,252,244,0.95); border: 1px solid rgba(122,89,58,0.2); box-shadow: 0 12px 28px rgba(59,45,30,0.18); pointer-events: auto; font-size: 2.2rem; }
        .image-chip { overflow: hidden; }
        .image-chip :global(img) { object-fit: contain; border-radius: 14px; }
        .leaf.image-chip { width: 64px; height: 50px; background: transparent; border: 0; box-shadow: 0 8px 14px rgba(52, 70, 30, 0.12); }
        @keyframes flash-pop {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.86); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes guard-pop {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .bag-chip :global(img) { object-fit: contain; border-radius: 12px; }
        .leaf { font-size: 2.6rem; }
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
        .dock :global(button) {
          border: 1px solid rgba(122, 87, 52, 0.22);
          box-shadow: 0 10px 22px rgba(74, 51, 28, 0.14);
        }
        .dock :global(.gate-action) {
          min-width: 118px;
          min-height: 72px;
          display: grid;
          grid-template-columns: 1fr;
          place-items: center;
          gap: 4px;
          border-radius: 18px;
          background: linear-gradient(180deg, #fff8eb, #f1d9ad);
        }
        .dock :global(.gate-action.hush) {
          background: linear-gradient(180deg, #edf7ff, #cce6f7);
        }
        .dock :global(.gate-action.open) {
          background: linear-gradient(180deg, #f5eadb, #d1b18a);
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

const rubyAlbumPhotos = [
  "KakaoTalk_20260623_101106536_02.jpg",
  "KakaoTalk_20260623_101106536_03.jpg",
  "KakaoTalk_20260623_101106536_05.jpg",
  "KakaoTalk_20260623_101106536_06.jpg",
  "KakaoTalk_20260623_101106536_07.jpg",
  "KakaoTalk_20260623_101106536_08.jpg",
  "KakaoTalk_20260623_101106536_09.jpg",
  "KakaoTalk_20260623_101106536_10.jpg",
  "KakaoTalk_20260623_101106536_11.jpg",
  "KakaoTalk_20260623_101106536_12.jpg",
  "KakaoTalk_20260623_101106536_16.jpg",
  "KakaoTalk_20260623_101106536_17.jpg",
  "KakaoTalk_20260623_101106536_18.jpg",
  "KakaoTalk_20260623_101106536_19.jpg",
  "KakaoTalk_20260623_101106536_20.jpg",
  "KakaoTalk_20260623_101106536_21.jpg",
  "KakaoTalk_20260623_101106536_22.jpg",
  "KakaoTalk_20260623_101106536_23.jpg",
  "KakaoTalk_20260623_101106536_24.jpg",
  "KakaoTalk_20260623_101106536_25.jpg",
  "KakaoTalk_20260623_101106536_28.jpg",
  "KakaoTalk_20260623_101106536_29.jpg",
  "KakaoTalk_20260623_101109566_02.jpg",
  "KakaoTalk_20260623_101109566.jpg",
];

const gamjaAlbumPhotos = [
  "KakaoTalk_20260623_104936603_01.jpg",
  "KakaoTalk_20260623_104936603_02.jpg",
  "KakaoTalk_20260623_104936603_03.jpg",
  "KakaoTalk_20260623_104936603_04.jpg",
  "KakaoTalk_20260623_104936603_05.jpg",
  "KakaoTalk_20260623_104936603_06.jpg",
  "KakaoTalk_20260623_104936603_07.jpg",
  "KakaoTalk_20260623_104936603_08.jpg",
  "KakaoTalk_20260623_104936603_09.jpg",
  "KakaoTalk_20260623_104936603_10.jpg",
  "KakaoTalk_20260623_104936603_11.jpg",
  "KakaoTalk_20260623_104936603_12.jpg",
  "KakaoTalk_20260623_104936603_13.jpg",
  "KakaoTalk_20260623_104936603_14.jpg",
  "KakaoTalk_20260623_104936603_15.jpg",
  "KakaoTalk_20260623_104936603_16.jpg",
  "KakaoTalk_20260623_104936603_17.jpg",
  "KakaoTalk_20260623_104936603_18.jpg",
  "KakaoTalk_20260623_104936603_20.jpg",
  "KakaoTalk_20260623_104936603_21.jpg",
  "KakaoTalk_20260623_104936603_22.jpg",
  "KakaoTalk_20260623_104936603_23.jpg",
  "KakaoTalk_20260623_104936603.jpg",
  "KakaoTalk_20260623_105048528_02.jpg",
  "KakaoTalk_20260623_105048528_03.jpg",
  "KakaoTalk_20260623_105048528_04.jpg",
  "KakaoTalk_20260623_105048528_05.jpg",
  "KakaoTalk_20260623_105048528_06.jpg",
  "KakaoTalk_20260623_105048528_08.jpg",
  "KakaoTalk_20260623_105048528_09.jpg",
  "KakaoTalk_20260623_105048528.jpg",
];

const togetherAlbumPhotos = [
  "KakaoTalk_20260623_101106536_14.jpg",
  "KakaoTalk_20260623_101106536_15.jpg",
  "KakaoTalk_20260623_101109566_01.jpg",
  "KakaoTalk_20260623_105048528_07.jpg",
];

type AlbumItem = {
  src: string;
  title: string;
  caption: string;
};

type AlbumTab = "ruby" | "gamja" | "together";

const togetherAlbumItems: AlbumItem[] = togetherAlbumPhotos.map((fileName, index) => ({
    src: `/ruby-gamja/루비감자앨범/${fileName}`,
    title: "루비&감자",
    caption: `함께한 순간 ${index + 1}`,
  }));

const rubyAlbumItems: AlbumItem[] = rubyAlbumPhotos.map((fileName, index) => ({
    src: `/ruby-gamja/루비앨범/${fileName}`,
    title: "루비 앨범",
    caption: `루비 사진 ${index + 1}`,
  }));

const gamjaAlbumItems: AlbumItem[] = gamjaAlbumPhotos.map((fileName, index) => ({
    src: `/ruby-gamja/감자앨범/${fileName}`,
    title: "감자 앨범",
    caption: `감자 사진 ${index + 1}`,
  }));

const albumTabs: Array<{ id: AlbumTab; label: string; items: AlbumItem[] }> = [
  { id: "ruby", label: "루비", items: rubyAlbumItems },
  { id: "gamja", label: "감자", items: gamjaAlbumItems },
  { id: "together", label: "루감", items: togetherAlbumItems },
];

function IntroStyles() {
  return (
    <style jsx global>{`
      .center-card.intro {
        position: absolute;
        z-index: 30;
        inset: 0;
        overflow: hidden;
        color: #3d2b20;
        font-family: 'Poor Story', 'Pretendard', sans-serif;
        pointer-events: auto;
      }

      .intro-bg {
        position: absolute;
        inset: 0;
        z-index: -3;
      }

      .intro-bg :global(img) {
        object-fit: cover;
        object-position: 62% 44%;
        filter: saturate(1.18) contrast(1.08) brightness(1.03);
        transform: scale(1.04);
      }

      .intro-bg::after {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(90deg, rgba(255, 251, 235, 0.18) 0%, rgba(255, 251, 235, 0.1) 26%, rgba(255, 251, 235, 0.01) 52%, rgba(255, 251, 235, 0.03) 100%),
          linear-gradient(180deg, rgba(221, 242, 255, 0.1) 0%, rgba(255, 255, 255, 0.01) 44%, rgba(242, 232, 166, 0.12) 100%);
      }

      .intro-sky {
        position: absolute;
        inset: 0;
        z-index: -4;
        background:
          radial-gradient(circle at 8% 10%, rgba(255,255,255,0.98), transparent 10rem),
          radial-gradient(circle at 92% 0%, rgba(185, 224, 130, 0.78), transparent 15rem),
          linear-gradient(180deg, #d8efff, #f7edb7);
      }

      .intro-hud {
        position: absolute;
        top: 18px;
        right: 22px;
        z-index: 4;
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
        max-width: min(680px, calc(100% - 300px));
        padding: 10px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.78);
        border: 1px solid rgba(255, 255, 255, 0.86);
        box-shadow: 0 14px 36px rgba(58, 45, 30, 0.16);
        backdrop-filter: blur(10px);
      }

      .intro-hud span {
        white-space: nowrap;
        font-family: 'Jua', 'Poor Story', sans-serif;
        font-size: clamp(0.82rem, 1.3vw, 1rem);
        color: #4d3c2e;
      }

      .intro-copy {
        position: absolute;
        top: 20px;
        left: 34px;
        z-index: 3;
        width: min(560px, 48%);
        text-align: left;
      }

      .intro-kicker {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        padding: 7px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.76);
        color: #3d2b20;
        font-family: 'Jua', 'Poor Story', sans-serif;
        box-shadow: 0 10px 24px rgba(83, 72, 48, 0.14);
      }

      h2 {
        margin: 0;
        font-family: 'Jua', 'Poor Story', sans-serif;
        font-size: clamp(2.3rem, 4.5vw, 4rem);
        line-height: 0.98;
        white-space: pre-line;
        color: #4b2f1f;
        letter-spacing: 0;
        text-shadow:
          0 4px 0 rgba(255,255,255,0.9),
          0 14px 28px rgba(74, 48, 28, 0.18);
      }

      h2::first-line {
        color: #4b2f1f;
      }

      .intro-copy p {
        margin: 12px 0 0;
        color: #4a3829;
        font-family: 'Poor Story', 'Pretendard', sans-serif;
        font-size: clamp(1.12rem, 1.7vw, 1.38rem);
        font-weight: 900;
        line-height: 1.55;
        text-shadow: 0 2px 0 rgba(255,255,255,0.86);
      }

      .mission-board {
        position: absolute;
        left: 34px;
        bottom: 118px;
        z-index: 3;
        width: min(360px, 38%);
        padding: 26px 22px 22px;
        border-radius: 26px;
        background: rgba(255, 255, 245, 0.72);
        border: 2px solid rgba(255, 255, 255, 0.9);
        box-shadow: 0 18px 46px rgba(61, 50, 28, 0.18);
        backdrop-filter: blur(12px);
      }

      .mission-board > b {
        position: absolute;
        top: -22px;
        left: 18px;
        display: inline-flex;
        align-items: center;
        padding: 12px 28px;
        border-radius: 18px;
        background: linear-gradient(180deg, #8bc15d, #5f9a37);
        color: #fffbe9;
        font-family: 'Jua', 'Poor Story', sans-serif;
        font-size: 1.1rem;
        box-shadow: 0 10px 22px rgba(78, 120, 45, 0.28);
      }

      .mission-board ul {
        list-style: none;
        display: grid;
        gap: 0;
        margin: 0;
        padding: 0;
      }

      .mission-board li {
        display: grid;
        grid-template-columns: 30px 1fr auto;
        align-items: center;
        gap: 10px;
        padding: 15px 0;
        border-bottom: 1px dashed rgba(104, 91, 68, 0.18);
        color: #3e3025;
        font-family: 'Jua', 'Poor Story', sans-serif;
        font-size: 1.1rem;
      }

      .mission-board li:last-child {
        border-bottom: 0;
      }

      .mission-board li span {
        width: 22px;
        height: 22px;
        border-radius: 999px;
        border: 3px solid rgba(107, 112, 69, 0.24);
        background: rgba(255,255,255,0.48);
      }

      .mission-board em {
        color: #6d963f;
        font-style: normal;
      }

      .dog-status {
        position: absolute;
        right: 52px;
        bottom: 210px;
        z-index: 3;
        display: flex;
        gap: 16px;
      }

      .dog-status article {
        display: grid;
        grid-template-columns: 62px 1fr;
        grid-template-rows: auto auto auto;
        column-gap: 12px;
        min-width: 160px;
        padding: 14px 16px;
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.78);
        border: 2px solid rgba(255,255,255,0.94);
        box-shadow: 0 16px 36px rgba(44, 34, 24, 0.2);
        backdrop-filter: blur(10px);
      }

      .dog-status article div {
        position: relative;
        grid-row: 1 / 4;
        width: 62px;
        height: 62px;
        border-radius: 999px;
        overflow: hidden;
        background: #fff7dd;
        border: 3px solid #75a447;
      }

      .dog-status article:nth-child(2) div {
        border-color: #e29b50;
      }

      .dog-status article div :global(img) {
        object-fit: cover;
      }

      .dog-status b {
        font-family: 'Jua', 'Poor Story', sans-serif;
        font-size: 1.35rem;
      }

      .dog-status span {
        font-weight: 900;
        color: #6c573f;
      }

      .dog-status i {
        width: 84px;
        height: 9px;
        margin-top: 6px;
        border-radius: 999px;
        background: linear-gradient(90deg, #f28662 0 24%, #7db24a 24%);
      }

      .intro-menu {
        position: absolute;
        left: 34px;
        right: auto;
        bottom: 20px;
        z-index: 4;
        display: grid;
        grid-template-columns: repeat(2, minmax(150px, 1fr));
        gap: 14px;
        width: min(360px, 34%);
      }

      .menu-card {
        min-width: 0;
        min-height: 96px;
        padding: 14px 10px;
        border-radius: 24px;
        border: 2px solid rgba(255,255,255,0.9);
        background: rgba(255, 255, 245, 0.76);
        color: #3f3023;
        box-shadow: 0 14px 34px rgba(68, 52, 31, 0.16);
        backdrop-filter: blur(10px);
      }

      .menu-card strong,
      .menu-card small {
        display: block;
      }

      .menu-card strong {
        font-family: 'Jua', 'Poor Story', sans-serif;
        font-size: clamp(0.96rem, 1.35vw, 1.15rem);
        white-space: nowrap;
      }

      .menu-card small {
        margin-top: 6px;
        color: #8a693f;
        font-size: 0.92rem;
        font-weight: 900;
      }

      .start-panel {
        position: absolute;
        right: 24px;
        bottom: 14px;
        z-index: 4;
        width: min(300px, 25%);
        padding: 14px;
        border-radius: 22px;
        background: rgba(255, 255, 245, 0.82);
        border: 2px solid rgba(255,255,255,0.92);
        box-shadow: 0 18px 42px rgba(71, 60, 35, 0.18);
        text-align: center;
        backdrop-filter: blur(12px);
      }

      .start-panel span {
        display: block;
        margin-bottom: 9px;
        color: #5e8e37;
        font-family: 'Jua', 'Poor Story', sans-serif;
        font-size: clamp(0.9rem, 1.25vw, 1.05rem);
      }

      .start-panel button {
        width: 100%;
        min-width: 0;
        padding: 15px 20px;
        border-radius: 999px;
        border: 0;
        background: linear-gradient(180deg, #85bd55, #4f9132);
        color: #fffbea;
        font-family: 'Jua', 'Poor Story', sans-serif;
        font-size: clamp(1.45rem, 2.45vw, 2.1rem);
        text-shadow: 0 3px 0 rgba(42, 79, 26, 0.28);
        box-shadow:
          inset 0 2px 0 rgba(255,255,255,0.35),
          0 10px 0 rgba(49, 102, 34, 0.32),
          0 18px 38px rgba(45, 88, 29, 0.34);
      }

      .home-overlay {
        position: fixed;
        z-index: 80;
        inset: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        background: rgba(32, 22, 16, 0.58);
        backdrop-filter: blur(8px);
        pointer-events: auto;
      }

      .home-modal {
        width: min(980px, 100%);
        max-height: min(760px, calc(100vh - 48px));
        overflow: auto;
        padding: 20px;
        border-radius: 28px;
        background: linear-gradient(180deg, #fffaf1, #f6dfbe);
        color: #4b3322;
        box-shadow: 0 32px 90px rgba(0,0,0,0.36);
      }

      .profile-modal {
        width: min(760px, 100%);
      }

      .modal-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 14px;
        margin-bottom: 16px;
      }

      .modal-head b {
        display: block;
        font-family: 'Jua', 'Poor Story', sans-serif;
        font-size: 2rem;
      }

      .modal-head span {
        color: #7b5b45;
        font-weight: 850;
      }

      .modal-head button {
        min-width: auto;
        padding: 10px 16px;
        border-radius: 999px;
        font-family: 'Jua', 'Poor Story', sans-serif;
        font-size: 1.05rem;
      }

      .profile-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        width: 100%;
      }

      .profile-row article {
        padding: 16px;
        border-radius: 24px;
        background: rgba(255, 248, 235, 0.86);
        color: #4b3322;
        border: 1px solid rgba(255, 255, 255, 0.44);
        box-shadow: 0 12px 28px rgba(34, 23, 16, 0.18);
        text-align: left;
      }

      .profile-photo {
        position: relative;
        height: 190px;
        margin-bottom: 10px;
        border-radius: 20px;
        overflow: hidden;
        background: linear-gradient(180deg, #f8ead5, #e8cfac);
      }

      .profile-photo :global(img) {
        object-fit: contain;
        padding: 10px;
      }

      .profile-row article span,
      .profile-row article b,
      .profile-row article p {
        display: block;
      }

      .profile-row article span {
        color: #b1744a;
        font-family: 'Jua', 'Poor Story', sans-serif;
      }

      .profile-row article b {
        font-family: 'Jua', 'Poor Story', sans-serif;
        font-size: 1.45rem;
      }

      .profile-row article p {
        margin: 4px 0 0;
        color: #5c4535;
        font-size: 1rem;
        line-height: 1.35;
      }

      .album-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }

      .album-tabs {
        display: flex;
        gap: 8px;
        margin: -4px 0 14px;
      }

      .album-tabs button {
        min-width: 0;
        padding: 9px 18px;
        border-radius: 999px;
        font-family: 'Jua', 'Poor Story', sans-serif;
        font-size: 1.1rem;
        color: #67452e;
        background: rgba(255, 250, 241, 0.8);
        border: 1px solid rgba(119, 82, 54, 0.16);
        box-shadow: none;
      }

      .album-tabs button.active {
        color: #fffaf1;
        background: linear-gradient(180deg, #89b65d, #5f963e);
        border-color: rgba(255, 255, 255, 0.56);
        box-shadow: 0 8px 18px rgba(70, 108, 39, 0.22);
      }

      .album-photo {
        position: relative;
        display: block;
        min-width: 0;
        height: 158px;
        padding: 0;
        overflow: hidden;
        border-radius: 18px;
        background: #efe1cf;
        border: 1px solid rgba(119, 82, 54, 0.16);
        box-shadow: 0 10px 24px rgba(82, 56, 35, 0.12);
        cursor: zoom-in;
      }

      .album-photo :global(img) {
        object-fit: cover;
        transition: transform 180ms ease;
      }

      .album-photo:hover :global(img) {
        transform: scale(1.04);
      }

      .photo-lightbox {
        position: fixed;
        z-index: 90;
        inset: 0;
        display: grid;
        place-items: center;
        padding: 52px 22px 24px;
        background: rgba(31, 22, 16, 0.76);
      }

      .lightbox-photo {
        position: relative;
        width: min(920px, 92vw);
        height: min(720px, 78vh);
        border-radius: 24px;
        overflow: hidden;
        background: #140f0c;
        box-shadow: 0 28px 80px rgba(0,0,0,0.42);
      }

      .lightbox-photo :global(img) {
        object-fit: contain;
      }

      .lightbox-close {
        position: absolute;
        z-index: 2;
        top: 18px;
        right: 22px;
        min-width: 0;
        padding: 10px 16px;
        border-radius: 999px;
        font-family: 'Jua', 'Poor Story', sans-serif;
        font-size: 1.05rem;
        color: #4b3322;
        background: #fffaf1;
        box-shadow: 0 12px 28px rgba(0,0,0,0.2);
      }

      .lightbox-nav {
        position: absolute;
        z-index: 2;
        top: 50%;
        display: grid;
        place-items: center;
        width: 54px;
        height: 54px;
        min-width: 0;
        padding: 0;
        border-radius: 50%;
        color: #4b3322;
        background: rgba(255, 250, 241, 0.92);
        box-shadow: 0 14px 32px rgba(0,0,0,0.26);
        transform: translateY(-50%);
      }

      .lightbox-arrow {
        display: block;
        width: 18px;
        height: 18px;
        border-top: 5px solid #4b3322;
        border-left: 5px solid #4b3322;
      }

      .lightbox-arrow.prev-icon {
        transform: translateX(4px) rotate(-45deg);
      }

      .lightbox-arrow.next-icon {
        transform: translateX(-4px) rotate(135deg);
      }

      .lightbox-prev {
        left: 22px;
      }

      .lightbox-next {
        right: 22px;
      }

      .lightbox-count {
        position: absolute;
        z-index: 2;
        left: 50%;
        bottom: 18px;
        padding: 8px 14px;
        border-radius: 999px;
        font-family: 'Jua', 'Poor Story', sans-serif;
        font-size: 1rem;
        color: #4b3322;
        background: rgba(255, 250, 241, 0.92);
        box-shadow: 0 10px 24px rgba(0,0,0,0.22);
        transform: translateX(-50%);
      }

      figure {
        margin: 0;
        overflow: hidden;
        border-radius: 20px;
        background: rgba(255,255,255,0.72);
        border: 1px solid rgba(119, 82, 54, 0.16);
        box-shadow: 0 10px 24px rgba(82, 56, 35, 0.12);
      }

      figure > div {
        position: relative;
        height: 150px;
        background: #efe1cf;
      }

      figure :global(img) {
        object-fit: cover;
      }

      figcaption {
        display: grid;
        gap: 2px;
        padding: 10px 12px 12px;
        text-align: left;
      }

      figcaption b {
        font-family: 'Jua', 'Poor Story', sans-serif;
        font-size: 1.1rem;
      }

      figcaption span {
        color: #775942;
        font-size: 0.95rem;
        line-height: 1.25;
      }

      @media (max-width: 900px) {
        .intro-copy {
          top: 28px;
          width: calc(100% - 36px);
        }

        .intro-hud {
          display: none;
        }

        .mission-board,
        .dog-status {
          display: none;
        }

        .intro-menu {
          left: 18px;
          right: 18px;
          bottom: 118px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .start-panel {
          left: 18px;
          right: 18px;
          bottom: 14px;
          width: auto;
          padding: 14px;
        }

        .album-grid,
        .profile-row {
          grid-template-columns: 1fr;
        }

        .album-photo {
          height: 220px;
        }
      }
    `}</style>
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
  const [albumOpen, setAlbumOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [albumTab, setAlbumTab] = useState<AlbumTab>("ruby");
  const [selectedAlbumPhoto, setSelectedAlbumPhoto] = useState<AlbumItem | null>(null);
  const isIntro = variant === "intro";
  const activeAlbumItems = albumTabs.find((tab) => tab.id === albumTab)?.items ?? rubyAlbumItems;
  const selectedAlbumIndex = selectedAlbumPhoto
    ? activeAlbumItems.findIndex((item) => item.src === selectedAlbumPhoto.src)
    : -1;

  const showAlbumPhoto = useCallback((direction: -1 | 1) => {
    if (!selectedAlbumPhoto || activeAlbumItems.length === 0) {
      return;
    }
    const currentIndex = activeAlbumItems.findIndex((item) => item.src === selectedAlbumPhoto.src);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + direction + activeAlbumItems.length) % activeAlbumItems.length;
    setSelectedAlbumPhoto(activeAlbumItems[nextIndex]);
  }, [activeAlbumItems, selectedAlbumPhoto]);

  useEffect(() => {
    if (!selectedAlbumPhoto) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showAlbumPhoto(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        showAlbumPhoto(1);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedAlbumPhoto(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAlbumPhoto, showAlbumPhoto]);

  if (isIntro) {
    return (
      <div className="center-card intro">
        <div className="intro-bg"><Image src={image} alt="루비와 감자" fill sizes="1180px" priority /></div>
        <div className="intro-sky" />
        <div className="intro-hud">
          <span>🏁 넘어짐 <b>0/3</b></span>
          <span>⏰ 시간 제한 없음</span>
          <span>🏅 루비 목줄 미착용</span>
          <span>🏅 감자 목줄 미착용</span>
          <span>💼 봉투 없음</span>
        </div>
        <section className="intro-copy" aria-label="게임 소개">
          <span className="intro-kicker">🐾 현실형 1인칭 산책 미션</span>
          <h2>{title}</h2>
          <p>루비와 감자와 함께 산책하고<br />다양한 미션을 완료해 보세요!</p>
        </section>
        <nav className="intro-menu" aria-label="홈 메뉴">
          <button type="button" className="menu-card" onClick={() => setProfileOpen(true)}>
            <strong>📖 루비&감자 소개</strong>
            <small>성격 보기</small>
          </button>
          <button type="button" className="menu-card" onClick={() => setAlbumOpen(true)}>
            <strong>🏆 루비&감자 앨범</strong>
            <small>사진 보기</small>
          </button>
        </nav>
        <section className="start-panel">
          <span>🍃 루비와 감자와 함께 떠나볼까요?</span>
          <button onClick={onClick}>{button}</button>
        </section>
        {profileOpen && (
          <div className="home-overlay" role="dialog" aria-modal="true" aria-label="루비 감자 소개">
            <div className="home-modal profile-modal">
              <div className="modal-head">
                <div>
                  <b>루비&감자 소개</b>
                  <span>오늘 산책을 함께할 주인공들이에요</span>
                </div>
                <button type="button" onClick={() => setProfileOpen(false)}>닫기</button>
              </div>
              <div className="profile-row">
                <article>
                  <div className="profile-photo"><Image src="/ruby-gamja/custom/ruby-come.png" alt="루비" fill sizes="220px" /></div>
                  <span>RUBY</span>
                  <b>루비 · 2021년생</b>
                  <p>사람을 좋아하고 호기심이 많은 강아지. 새로운 길도 먼저 킁킁 확인해요.</p>
                </article>
                <article>
                  <div className="profile-photo"><Image src="/ruby-gamja/custom/gamja-come.png" alt="감자" fill sizes="220px" /></div>
                  <span>GAMJA</span>
                  <b>감자 · 2016년생</b>
                  <p>루비보다 언니예요. 한번 마음을 열면 끝까지 지켜주는 의리 있는 강아지예요.</p>
                </article>
              </div>
            </div>
          </div>
        )}
        {albumOpen && (
          <div className="home-overlay" role="dialog" aria-modal="true" aria-label="루비 감자 앨범">
            <div className="home-modal album-card">
              <div className="modal-head">
                <div>
                  <b>루감이 앨범</b>
                  <span>산책 전에 사진부터 보고 가요</span>
                </div>
                <button type="button" onClick={() => setAlbumOpen(false)}>닫기</button>
              </div>
              <div className="album-tabs" role="tablist" aria-label="앨범 선택">
                {albumTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={albumTab === tab.id ? "active" : ""}
                    onClick={() => setAlbumTab(tab.id)}
                    role="tab"
                    aria-selected={albumTab === tab.id}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="album-grid">
                {activeAlbumItems.map((item) => (
                  <button
                    key={item.src}
                    type="button"
                    className="album-photo"
                    onClick={() => setSelectedAlbumPhoto(item)}
                    aria-label={`${item.title} 크게 보기`}
                  >
                    <Image src={item.src} alt={item.title} fill sizes="220px" />
                  </button>
                ))}
              </div>
            </div>
            {selectedAlbumPhoto && (
              <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="앨범 사진 크게 보기">
                <button type="button" className="lightbox-close" onClick={() => setSelectedAlbumPhoto(null)}>닫기</button>
                <button type="button" className="lightbox-nav lightbox-prev" onClick={() => showAlbumPhoto(-1)} aria-label="이전 사진">
                  <span className="lightbox-arrow prev-icon" aria-hidden="true" />
                </button>
                <div className="lightbox-photo">
                  <Image src={selectedAlbumPhoto.src} alt={selectedAlbumPhoto.title} fill sizes="90vw" />
                                </div>
                <button type="button" className="lightbox-nav lightbox-next" onClick={() => showAlbumPhoto(1)} aria-label="다음 사진">
                  <span className="lightbox-arrow next-icon" aria-hidden="true" />
                </button>
                <div className="lightbox-count">{selectedAlbumIndex + 1} / {activeAlbumItems.length}</div>
              </div>
            )}
          </div>
        )}
        <IntroStyles />
      </div>
    );
  }

  return (
    <div className={`center-card ${variant}`}>
      <div className="hero-dogs"><Image src={image} alt="루비와 감자" fill sizes="520px" priority /></div>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      {isIntro && (
        <div className="intro-home">
          <button type="button" className="home-button" onClick={() => setProfileOpen(true)}>루비 감자 소개</button>
          <button type="button" className="home-button" onClick={() => setAlbumOpen(true)}>루감이 앨범 보기</button>
        </div>
      )}
      <button onClick={onClick}>{button}</button>
      {isIntro && profileOpen && (
        <div className="home-overlay" role="dialog" aria-modal="true" aria-label="루비 감자 소개">
          <div className="home-modal profile-modal">
            <div className="modal-head">
              <div>
                <b>루비 감자 소개</b>
                <span>오늘 산책을 함께할 주인공들이에요</span>
              </div>
              <button type="button" onClick={() => setProfileOpen(false)}>닫기</button>
            </div>
            <div className="profile-row">
              <article>
                <div className="profile-photo"><Image src="/ruby-gamja/custom/ruby-come.png" alt="루비" fill sizes="220px" /></div>
                <span>RUBY</span>
                <b>루비</b>
                <p>산책길을 앞장서는 든든한 언니. 신나면 줄을 살짝 당겨요.</p>
              </article>
              <article>
                <div className="profile-photo"><Image src="/ruby-gamja/custom/gamja-come.png" alt="감자" fill sizes="220px" /></div>
                <span>GAMJA</span>
                <b>감자</b>
                <p>작지만 목소리는 큰 귀염둥이. 냄새 맡기와 영역 표시 담당.</p>
              </article>
            </div>
          </div>
        </div>
      )}
      {isIntro && albumOpen && (
        <div className="home-overlay" role="dialog" aria-modal="true" aria-label="루비 감자 앨범">
          <div className="home-modal album-card">
            <div className="modal-head">
              <div>
                <b>루감이 앨범</b>
                <span>산책 전에 사진부터 보고 가요</span>
              </div>
              <button type="button" onClick={() => setAlbumOpen(false)}>닫기</button>
            </div>
            <div className="album-tabs" role="tablist" aria-label="앨범 선택">
              {albumTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={albumTab === tab.id ? "active" : ""}
                  onClick={() => setAlbumTab(tab.id)}
                  role="tab"
                  aria-selected={albumTab === tab.id}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="album-grid">
              {activeAlbumItems.map((item) => (
                <button
                  key={item.src}
                  type="button"
                  className="album-photo"
                  onClick={() => setSelectedAlbumPhoto(item)}
                  aria-label={`${item.title} 크게 보기`}
                >
                  <Image src={item.src} alt={item.title} fill sizes="220px" />
                </button>
              ))}
            </div>
          </div>
          {selectedAlbumPhoto && (
            <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="앨범 사진 크게 보기">
              <button type="button" className="lightbox-close" onClick={() => setSelectedAlbumPhoto(null)}>닫기</button>
              <button type="button" className="lightbox-nav lightbox-prev" onClick={() => showAlbumPhoto(-1)} aria-label="이전 사진">
                <span className="lightbox-arrow prev-icon" aria-hidden="true" />
              </button>
              <div className="lightbox-photo">
                <Image src={selectedAlbumPhoto.src} alt={selectedAlbumPhoto.title} fill sizes="90vw" />
                            </div>
              <button type="button" className="lightbox-nav lightbox-next" onClick={() => showAlbumPhoto(1)} aria-label="다음 사진">
                <span className="lightbox-arrow next-icon" aria-hidden="true" />
              </button>
              <div className="lightbox-count">{selectedAlbumIndex + 1} / {activeAlbumItems.length}</div>
            </div>
          )}
        </div>
      )}
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
          width: 100%;
          height: 100%;
          min-height: 100%;
          background: transparent;
          color: #4b3322;
          padding: 10px 24px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          text-align: center;
          border-radius: 0;
          box-shadow: none;
          overflow: visible;
          transform: translate(-50%, -50%);
          pointer-events: none;
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
            radial-gradient(circle at 18% 18%, rgba(255, 233, 202, 0.34), transparent 10rem),
            linear-gradient(180deg, rgba(255, 247, 232, 0.46), transparent 34%, rgba(34, 24, 17, 0.08));
        }
        .hero-dogs :global(img) { object-fit: cover; }
        .intro .hero-dogs {
          inset: 0;
          height: 100%;
          z-index: -1;
          filter: none;
          display: none;
        }
        .intro .hero-dogs::after {
          display: block;
          background:
            linear-gradient(180deg, rgba(255, 249, 238, 0.2) 0%, rgba(255, 249, 238, 0.06) 22%, transparent 52%);
        }
        .intro .hero-dogs :global(img) {
          object-fit: cover;
        }
        h2 {
          position: relative;
          z-index: 1;
          margin: 0 0 10px;
          font-family: 'Jua', 'Poor Story', 'Pretendard', sans-serif;
          font-size: clamp(2.4rem, 7vw, 5rem);
          line-height: 0.92;
          white-space: pre-line;
          color: #fff6e8;
          text-shadow:
            0 5px 0 rgba(62, 42, 28, 0.92),
            0 13px 24px rgba(0,0,0,0.45);
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
        .intro h2 {
          width: auto;
          max-width: min(620px, calc(100% - 32px));
          margin: 0;
          padding: 8px 20px 10px;
          border-radius: 999px;
          background: rgba(255, 248, 235, 0.76);
          font-size: clamp(1.9rem, 4.3vw, 3.35rem);
          line-height: 0.9;
          color: #3d2b20;
          text-shadow:
            0 3px 0 rgba(255, 255, 255, 0.92),
            0 10px 22px rgba(82, 54, 33, 0.24);
          box-shadow: 0 12px 28px rgba(57, 38, 24, 0.12);
          pointer-events: auto;
        }
        .intro-home {
          position: relative;
          z-index: 1;
          display: flex;
          flex-wrap: wrap;
          justify-items: center;
          justify-content: center;
          gap: 8px;
          width: min(520px, calc(100% - 32px));
          max-width: 520px;
          margin: auto auto 12px;
          padding: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          pointer-events: auto;
        }
        .profile-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          width: 100%;
        }
        .profile-row article {
          padding: 16px;
          border-radius: 24px;
          background: rgba(255, 248, 235, 0.86);
          color: #4b3322;
          border: 1px solid rgba(255, 255, 255, 0.44);
          box-shadow: 0 12px 28px rgba(34, 23, 16, 0.18);
          text-align: left;
          backdrop-filter: blur(10px);
        }
        .profile-photo {
          position: relative;
          height: 190px;
          margin-bottom: 10px;
          border-radius: 20px;
          overflow: hidden;
          background: linear-gradient(180deg, #f8ead5, #e8cfac);
        }
        .profile-photo :global(img) {
          object-fit: contain;
          padding: 10px;
        }
        .profile-row article span {
          display: inline-block;
          margin-bottom: 2px;
          color: #b1744a;
          font-family: 'Jua', 'Poor Story', 'Pretendard', sans-serif;
          font-size: 0.9rem;
        }
        .profile-row article b {
          display: block;
          font-family: 'Jua', 'Poor Story', 'Pretendard', sans-serif;
          font-size: 1.45rem;
          color: #3f2c20;
        }
        .profile-row article p {
          margin: 4px 0 0;
          color: #5c4535;
          font-size: 1rem;
          line-height: 1.35;
          text-shadow: none;
        }
        .home-button {
          min-width: 132px;
          padding: 9px 12px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(255,250,241,0.96), rgba(243,214,173,0.94));
          color: #5b3927;
          box-shadow: 0 12px 26px rgba(37, 24, 17, 0.2);
          font-size: 1rem;
        }
        button {
          position: relative;
          z-index: 1;
          font-family: 'Jua', 'Poor Story', 'Pretendard', sans-serif;
          background: linear-gradient(180deg, #fff3d7, #dfbf8c);
          color: #4b3322;
          border: 2px solid rgba(255, 255, 255, 0.35);
          min-width: 240px;
          padding: 18px 26px;
          border-radius: 22px;
          font-size: clamp(1.25rem, 3vw, 1.8rem);
        }
        .intro > button {
          min-width: min(320px, calc(100% - 48px));
          margin: 0 0 24px;
          padding: 18px 28px;
          font-size: clamp(1.35rem, 3vw, 2rem);
          box-shadow: 0 16px 34px rgba(61, 39, 24, 0.24);
          pointer-events: auto;
        }
        .home-overlay {
          position: fixed;
          z-index: 80;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 24px;
          background: rgba(32, 22, 16, 0.58);
          backdrop-filter: blur(8px);
          pointer-events: auto;
        }
        .home-modal {
          width: min(980px, 100%);
          max-height: min(760px, calc(100vh - 48px));
          overflow: auto;
          padding: 20px;
          border-radius: 28px;
          background: linear-gradient(180deg, #fffaf1, #f6dfbe);
          color: #4b3322;
          box-shadow: 0 32px 90px rgba(0,0,0,0.36);
        }
        .profile-modal {
          width: min(760px, 100%);
        }
        .modal-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
        }
        .modal-head b {
          display: block;
          font-family: 'Jua', 'Poor Story', 'Pretendard', sans-serif;
          font-size: 2rem;
        }
        .modal-head span {
          color: #7b5b45;
          font-weight: 850;
        }
        .modal-head button {
          min-width: auto;
          padding: 10px 16px;
          border-radius: 999px;
          font-size: 1.05rem;
        }
        .album-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        .album-tabs {
          display: flex;
          gap: 8px;
          margin: -4px 0 14px;
        }
        .album-tabs button {
          min-width: 0;
          padding: 9px 18px;
          border-radius: 999px;
          font-size: 1.1rem;
          color: #67452e;
          background: rgba(255, 250, 241, 0.8);
          border: 1px solid rgba(119, 82, 54, 0.16);
          box-shadow: none;
        }
        .album-tabs button.active {
          color: #fffaf1;
          background: linear-gradient(180deg, #89b65d, #5f963e);
          border-color: rgba(255, 255, 255, 0.56);
          box-shadow: 0 8px 18px rgba(70, 108, 39, 0.22);
        }
        .album-photo {
          position: relative;
          display: block;
          min-width: 0;
          height: 158px;
          padding: 0;
          overflow: hidden;
          border-radius: 18px;
          background: #efe1cf;
          border: 1px solid rgba(119, 82, 54, 0.16);
          box-shadow: 0 10px 24px rgba(82, 56, 35, 0.12);
          cursor: zoom-in;
        }
        .album-photo :global(img) {
          object-fit: cover;
          transition: transform 180ms ease;
        }
        .album-photo:hover :global(img) {
          transform: scale(1.04);
        }
        .photo-lightbox {
          position: fixed;
          z-index: 90;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 52px 22px 24px;
          background: rgba(31, 22, 16, 0.76);
        }
        .lightbox-photo {
          position: relative;
          width: min(920px, 92vw);
          height: min(720px, 78vh);
          border-radius: 24px;
          overflow: hidden;
          background: #140f0c;
          box-shadow: 0 28px 80px rgba(0,0,0,0.42);
        }
        .lightbox-photo :global(img) {
          object-fit: contain;
        }
        .lightbox-close {
          position: absolute;
          z-index: 2;
          top: 18px;
          right: 22px;
          min-width: 0;
          padding: 10px 16px;
          border-radius: 999px;
          font-size: 1.05rem;
          color: #4b3322;
          background: #fffaf1;
          box-shadow: 0 12px 28px rgba(0,0,0,0.2);
        }

        .lightbox-nav {
          position: absolute;
          z-index: 2;
          top: 50%;
          display: grid;
          place-items: center;
          width: 54px;
          height: 54px;
          min-width: 0;
          padding: 0;
          border-radius: 50%;
          color: #4b3322;
          background: rgba(255, 250, 241, 0.92);
          box-shadow: 0 14px 32px rgba(0,0,0,0.26);
          transform: translateY(-50%);
        }

        .lightbox-arrow {
          display: block;
          width: 18px;
          height: 18px;
          border-top: 5px solid #4b3322;
          border-left: 5px solid #4b3322;
        }

        .lightbox-arrow.prev-icon {
          transform: translateX(4px) rotate(-45deg);
        }

        .lightbox-arrow.next-icon {
          transform: translateX(-4px) rotate(135deg);
        }

        .lightbox-prev {
          left: 22px;
        }

        .lightbox-next {
          right: 22px;
        }

        .lightbox-count {
          position: absolute;
          z-index: 2;
          left: 50%;
          bottom: 18px;
          padding: 8px 14px;
          border-radius: 999px;
          font-family: 'Jua', 'Poor Story', sans-serif;
          font-size: 1rem;
          color: #4b3322;
          background: rgba(255, 250, 241, 0.92);
          box-shadow: 0 10px 24px rgba(0,0,0,0.22);
          transform: translateX(-50%);
        }
        figure {
          margin: 0;
          overflow: hidden;
          border-radius: 20px;
          background: rgba(255,255,255,0.72);
          border: 1px solid rgba(119, 82, 54, 0.16);
          box-shadow: 0 10px 24px rgba(82, 56, 35, 0.12);
        }
        figure > div {
          position: relative;
          height: 150px;
          background: #efe1cf;
        }
        figure :global(img) {
          object-fit: cover;
        }
        figcaption {
          display: grid;
          gap: 2px;
          padding: 10px 12px 12px;
          text-align: left;
        }
        figcaption b {
          font-family: 'Jua', 'Poor Story', 'Pretendard', sans-serif;
          font-size: 1.1rem;
        }
        figcaption span {
          color: #775942;
          font-size: 0.95rem;
          line-height: 1.25;
        }
        @media (max-width: 820px) {
          .center-card.intro {
            min-height: 100%;
            padding: 16px;
          }
          .intro h2 {
            max-width: calc(100% - 20px);
            font-size: clamp(1.8rem, 9vw, 3rem);
          }
          .intro-home {
            width: calc(100% - 18px);
            max-width: 360px;
          }
          .intro > button {
            margin-bottom: 18px;
          }
          .profile-row,
          .album-grid {
            grid-template-columns: 1fr;
          }
          .album-grid {
            max-height: 58vh;
            overflow: auto;
          }
          .album-photo {
            height: 220px;
          }
        }
      `}</style>
    </div>
  );
}
