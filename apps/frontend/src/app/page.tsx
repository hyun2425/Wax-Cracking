"use client";

import { type MouseEvent, useCallback, useEffect, useMemo, useState } from "react";

type ApiState =
  | { status: "checking" }
  | { status: "online"; service: string; database: string }
  | { status: "offline"; message: string };

type WaxType = {
  name: string;
  description: string;
  tone: string;
  accent: string;
  ballClassName: string;
  chipClassName: string;
  frequency: number;
};

type CrackPoint = {
  id: number;
  x: number;
  y: number;
  rotation: number;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8080";

const waxTypes: WaxType[] = [
  {
    name: "두바이 왁스볼",
    description: "초콜릿빛 외피와 금빛 라인이 있는 묵직한 왁스볼입니다.",
    tone: "묵직한 파열음",
    accent: "고급스럽고 단단한 이미지",
    ballClassName: "from-[#2d1c15] via-[#7b4b31] to-[#d7a948]",
    chipClassName: "bg-[#d7a948]",
    frequency: 150,
  },
  {
    name: "솜사탕 왁스볼",
    description: "분홍, 하늘, 보라색이 섞인 부드러운 왁스볼입니다.",
    tone: "가벼운 바스락 소리",
    accent: "부드럽고 가벼운 이미지",
    ballClassName: "from-[#f08aa9] via-[#98d8ef] to-[#a487df]",
    chipClassName: "bg-[#f08aa9]",
    frequency: 310,
  },
  {
    name: "청사과 왁스볼",
    description: "연두색 표면이 시원하고 산뜻한 왁스볼입니다.",
    tone: "깨끗한 크랙 사운드",
    accent: "산뜻하고 시원한 이미지",
    ballClassName: "from-[#d9ff8f] via-[#9bd66a] to-[#4e9b70]",
    chipClassName: "bg-[#9bd66a]",
    frequency: 240,
  },
];

const freezerRows = [
  { max: 5, label: "0~5분", state: "말랑", sound: "톡" },
  { max: 10, label: "5~10분", state: "보통", sound: "빠각" },
  { max: 15, label: "10~15분", state: "단단", sound: "바삭" },
  { max: 19, label: "15~20분", state: "매우 단단", sound: "쩌억" },
  { max: 20, label: "20분", state: "최고 경도", sound: "크그작" },
];

const crackSteps = ["클릭 시작", "작은 균열", "균열 확장", "완전 파괴", "소리 재생"];

function getFreezerState(minutes: number) {
  return freezerRows.find((row) => minutes <= row.max) ?? freezerRows.at(-1)!;
}

export default function Home() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [freezerMinutes, setFreezerMinutes] = useState(0);
  const [isFreezing, setIsFreezing] = useState(false);
  const [crackProgress, setCrackProgress] = useState(0);
  const [crackPoints, setCrackPoints] = useState<CrackPoint[]>([]);
  const [apiState, setApiState] = useState<ApiState>({ status: "checking" });

  const selectedWax = waxTypes[selectedIndex];
  const freezerState = getFreezerState(freezerMinutes);
  const healthUrl = useMemo(() => `${apiBaseUrl}/api/health`, []);
  const requiredClicks = Math.max(3, 8 - Math.floor(freezerMinutes / 4));
  const crackPercent = Math.min(100, Math.round((crackProgress / requiredClicks) * 100));
  const isBroken = crackPercent >= 100;

  useEffect(() => {
    if (!isFreezing) {
      return;
    }

    const timerId = window.setInterval(() => {
      setFreezerMinutes((current) => {
        if (current >= 19) {
          setIsFreezing(false);
          return 20;
        }

        return current + 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isFreezing]);

  useEffect(() => {
    const controller = new AbortController();

    async function checkApi() {
      try {
        const response = await fetch(healthUrl, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API ${response.status}`);
        }

        const data = await response.json();
        setApiState({
          status: "online",
          service: data.service ?? "backend",
          database: data.database ?? "disabled",
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setApiState({
            status: "offline",
            message:
              error instanceof Error ? error.message : "API 연결 대기 중",
          });
        }
      }
    }

    void checkApi();

    return () => controller.abort();
  }, [healthUrl]);

  const playCrackSound = useCallback((isFinal = false) => {
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    const audioContext = new AudioContextClass();
    const now = audioContext.currentTime;
    const masterGain = audioContext.createGain();
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.18;
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(isFinal ? 0.5 : 0.18, now + 0.006);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + (isFinal ? 0.62 : 0.16));
    masterGain.connect(compressor);
    compressor.connect(audioContext.destination);

    const highCracks = isFinal
      ? [0, 0.014, 0.031, 0.052, 0.083, 0.123, 0.176, 0.241, 0.315]
      : [0, 0.022, 0.047];

    highCracks.forEach((delay, index) => {
      const duration = isFinal ? 0.045 + (index % 3) * 0.018 : 0.026;
      const buffer = audioContext.createBuffer(
        1,
        Math.floor(audioContext.sampleRate * duration),
        audioContext.sampleRate,
      );
      const data = buffer.getChannelData(0);

      for (let sample = 0; sample < data.length; sample += 1) {
        const fade = 1 - sample / data.length;
        data[sample] = (Math.random() * 2 - 1) * fade * fade;
      }

      const source = audioContext.createBufferSource();
      const bandPass = audioContext.createBiquadFilter();
      const grainGain = audioContext.createGain();
      source.buffer = buffer;
      bandPass.type = "bandpass";
      bandPass.frequency.setValueAtTime(
        2200 + freezerMinutes * 80 + index * 360,
        now + delay,
      );
      bandPass.Q.setValueAtTime(isFinal ? 4.5 : 6.5, now + delay);
      grainGain.gain.setValueAtTime(0.0001, now + delay);
      grainGain.gain.exponentialRampToValueAtTime(
        isFinal ? 0.18 + index * 0.012 : 0.1,
        now + delay + 0.004,
      );
      grainGain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
      source.connect(bandPass);
      bandPass.connect(grainGain);
      grainGain.connect(masterGain);
      source.start(now + delay);
      source.stop(now + delay + duration);
    });

    const shellSnaps = isFinal ? [0.018, 0.075, 0.154, 0.258] : [0.012];
    shellSnaps.forEach((delay, index) => {
      const oscillator = audioContext.createOscillator();
      const clickGain = audioContext.createGain();
      oscillator.type = index === 0 ? "triangle" : "square";
      oscillator.frequency.setValueAtTime(
        selectedWax.frequency * 8 + freezerMinutes * 28 + index * 430,
        now + delay,
      );
      clickGain.gain.setValueAtTime(0.0001, now + delay);
      clickGain.gain.exponentialRampToValueAtTime(isFinal ? 0.12 : 0.08, now + delay + 0.003);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.045);
      oscillator.connect(clickGain);
      clickGain.connect(masterGain);
      oscillator.start(now + delay);
      oscillator.stop(now + delay + 0.05);
    });

    if (isFinal) {
      const thump = audioContext.createOscillator();
      const thumpGain = audioContext.createGain();
      thump.type = "sine";
      thump.frequency.setValueAtTime(70 + freezerMinutes * 2, now + 0.02);
      thump.frequency.exponentialRampToValueAtTime(35, now + 0.26);
      thumpGain.gain.setValueAtTime(0.0001, now + 0.02);
      thumpGain.gain.exponentialRampToValueAtTime(0.24, now + 0.04);
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      thump.connect(thumpGain);
      thumpGain.connect(masterGain);
      thump.start(now + 0.02);
      thump.stop(now + 0.34);
    }

    window.setTimeout(() => {
      void audioContext.close();
    }, isFinal ? 900 : 300);
  }, [freezerMinutes, selectedWax.frequency]);

  function handleSelectWax(index: number) {
    setSelectedIndex(index);
    setCrackProgress(0);
    setCrackPoints([]);
  }

  function handleStartFreezer() {
    setCrackProgress(0);
    setCrackPoints([]);
    setIsFreezing(true);
  }

  function handleReset() {
    setFreezerMinutes(0);
    setIsFreezing(false);
    setCrackProgress(0);
    setCrackPoints([]);
  }

  function handleCrack(event: MouseEvent<HTMLButtonElement>) {
    if (isBroken) {
      playCrackSound(true);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const next = Math.min(requiredClicks, crackProgress + 1);
    const isFinal = next >= requiredClicks;

    setCrackPoints((current) => [
      ...current,
      {
        id: Date.now(),
        x: ((event.clientX - rect.left) / rect.width) * 100,
        y: ((event.clientY - rect.top) / rect.height) * 100,
        rotation: (current.length * 47) % 110 - 55,
      },
    ]);
    setCrackProgress(next);
    playCrackSound(isFinal);

  }

  return (
    <main className="min-h-screen bg-[#fbfaf6] text-[#191611]">
      <header className="border-b border-[#e6ded2] bg-[linear-gradient(118deg,#fffaf2_0%,#f5fbff_54%,#dff5ff_100%)]">
        <nav
          className="mx-auto flex w-[min(1120px,calc(100%-32px))] items-center justify-between gap-5 py-6 max-md:flex-col max-md:items-start"
          aria-label="주요 메뉴"
        >
          <strong className="text-[15px] font-extrabold">
            Online Wax-Cracking Ball
          </strong>
          <div className="flex flex-wrap gap-5 text-sm font-bold text-[#6f685e]">
            <a href="#simulator">시뮬레이터</a>
            <a href="#features">왁스볼</a>
            <a href="#freezer">냉동 규칙</a>
            <a href="#deploy">연결 상태</a>
            <a href="/hsj-ver">HSJ.ver</a>
          </div>
        </nav>

        <section className="mx-auto grid w-[min(1120px,calc(100%-32px))] grid-cols-[minmax(0,1fr)_minmax(320px,0.86fr)] items-center gap-14 py-16 max-md:grid-cols-1">
          <div>
            <p className="mb-3 text-sm font-extrabold uppercase text-[#3f88c5]">
              ASMR Simulation Service
            </p>
            <h1 className="max-w-3xl text-6xl font-extrabold leading-none text-[#191611] sm:text-7xl lg:text-8xl">
              온라인 왁스볼
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#6f685e]">
              왁스볼을 고르고 냉동실에 넣은 뒤 마우스로 눌러 깨뜨리는
              반복 플레이형 ASMR 시뮬레이션입니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#191611] px-5 text-sm font-extrabold text-white"
                href="#simulator"
              >
                바로 체험하기
              </a>
              <a
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#e6ded2] bg-white/70 px-5 text-sm font-extrabold text-[#191611]"
                href="#freezer"
              >
                냉동 규칙 보기
              </a>
            </div>
          </div>

          <WaxPreview
            crackPoints={crackPoints}
            crackPercent={crackPercent}
            freezerMinutes={freezerMinutes}
            freezerState={freezerState.state}
            isBroken={isBroken}
            onCrack={handleCrack}
            selectedWax={selectedWax}
          />
        </section>
      </header>

      <section
        className="mx-auto grid w-[min(1120px,calc(100%-32px))] grid-cols-[minmax(0,0.92fr)_minmax(360px,1fr)] gap-8 py-20 max-md:grid-cols-1"
        id="simulator"
      >
        <div className="rounded-lg border border-[#e6ded2] bg-white p-5 shadow-sm">
          <SectionHeading eyebrow="Play" title="왁스볼 깨기 체험" />

          <div className="grid gap-3">
            {waxTypes.map((wax, index) => (
              <button
                className={`flex min-h-20 items-center gap-4 rounded-lg border p-4 text-left transition ${
                  selectedIndex === index
                    ? "border-[#3f88c5] bg-[#eef8fd]"
                    : "border-[#e6ded2] bg-white hover:border-[#9ccce7]"
                }`}
                key={wax.name}
                onClick={() => handleSelectWax(index)}
                type="button"
              >
                <span
                  className={`aspect-square w-12 shrink-0 rounded-full bg-gradient-to-br ${wax.ballClassName} shadow-[inset_-8px_-10px_14px_rgba(0,0,0,0.2)]`}
                />
                <span>
                  <strong className="block text-base">{wax.name}</strong>
                  <span className="text-sm leading-6 text-[#6f685e]">
                    {wax.description}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 max-sm:grid-cols-1">
            <button
              className="min-h-12 rounded-lg bg-[#191611] px-4 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#b8aea2]"
              disabled={isFreezing || freezerMinutes >= 20}
              onClick={handleStartFreezer}
              type="button"
            >
              냉동 시작
            </button>
            <button
              className="min-h-12 rounded-lg border border-[#e6ded2] bg-[#f7efe2] px-4 text-sm font-extrabold"
              onClick={handleReset}
              type="button"
            >
              다시 시작
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-[#e6ded2] bg-[#f7efe2] p-5">
          <div className="grid gap-4">
            <StatusMetric label="선택한 왁스볼" value={selectedWax.name} />
            <StatusMetric
              label="냉동 시간"
              value={`${freezerMinutes}분 / 실제 ${freezerMinutes}초`}
            />
            <StatusMetric
              label="현재 상태"
              value={`${freezerState.state} · ${freezerState.sound}`}
            />
            <StatusMetric label="파괴 진행률" value={`${crackPercent}%`} />
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-[#3f88c5] transition-all"
              style={{ width: `${freezerMinutes * 5}%` }}
            />
          </div>
          <p className="mt-2 text-sm font-bold text-[#6f685e]">
            1초 = 1분, 최대 냉동 시간은 20분입니다.
          </p>
          <p className="mt-3 rounded-md bg-white px-4 py-3 text-sm font-extrabold text-[#3f88c5]">
            위쪽 왁스볼을 직접 클릭해서 깨뜨려 보세요. 마지막 균열에서 파괴음이 재생됩니다.
          </p>
        </div>
      </section>

      <section
        className="mx-auto w-[min(1120px,calc(100%-32px))] py-20"
        id="features"
      >
        <SectionHeading eyebrow="Wax Ball Types" title="선택 가능한 왁스볼" />
        <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
          {waxTypes.map((wax) => (
            <article
              className="flex min-h-[280px] flex-col rounded-lg border border-[#e6ded2] bg-white p-6 shadow-sm"
              key={wax.name}
            >
              <div
                className={`aspect-square w-[74px] rounded-full bg-gradient-to-br ${wax.ballClassName} shadow-[inset_-12px_-14px_18px_rgba(0,0,0,0.2)]`}
              />
              <h3 className="mt-5 text-2xl font-extrabold">{wax.name}</h3>
              <p className="mt-2 text-[15px] leading-7 text-[#6f685e]">
                {wax.description}
              </p>
              <span className="mt-auto pt-6 text-sm font-extrabold text-[#3f88c5]">
                {wax.tone}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section
        className="mx-auto grid w-[min(1120px,calc(100%-32px))] grid-cols-[minmax(0,0.9fr)_minmax(320px,1fr)] gap-11 py-20 max-md:grid-cols-1"
        id="freezer"
      >
        <div>
          <p className="mb-3 text-sm font-extrabold uppercase text-[#3f88c5]">
            Freezer System
          </p>
          <h2 className="text-4xl font-extrabold leading-tight sm:text-5xl">
            냉동 시간이 길수록 더 단단하게
          </h2>
          <p className="mt-5 text-lg leading-8 text-[#6f685e]">
            기다리는 부담을 줄이기 위해 게임 안에서는 1초가 1분처럼
            적용됩니다. 오래 얼릴수록 클릭 횟수는 줄고 균열 효과는 더
            선명해집니다.
          </p>
        </div>

        <div className="rounded-lg border border-[#e6ded2] bg-[#f7efe2] p-3">
          {freezerRows.map((row) => (
            <div
              className={`grid min-h-14 grid-cols-[1fr_1fr_1fr] items-center gap-4 border-b border-[#e6ded2] px-4 py-3 text-sm last:border-b-0 ${
                freezerState.label === row.label
                  ? "rounded-md bg-[#3f88c5] text-white"
                  : ""
              }`}
              key={row.label}
            >
              <strong>{row.label}</strong>
              <span>{row.state}</span>
              <span className="font-extrabold">{row.sound}</span>
            </div>
          ))}
        </div>
      </section>

      <section
        className="border-y border-[#e6ded2] bg-white/45 py-20"
        id="sound"
      >
        <div className="mx-auto w-[min(1120px,calc(100%-32px))]">
          <SectionHeading eyebrow="ASMR Sound" title="깨지는 순간의 소리 변화" />
          <div className="grid grid-cols-5 gap-3 max-md:grid-cols-1">
            {freezerRows.map((row) => (
              <span
                className="grid min-h-24 place-items-center rounded-lg border border-[#e6ded2] bg-white px-3 text-center text-2xl font-extrabold shadow-sm"
                key={row.sound}
              >
                {row.sound}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-20">
        <SectionHeading eyebrow="Cracking Flow" title="마우스 클릭 파괴 과정" />
        <ol className="grid list-none grid-cols-5 gap-3 p-0 max-md:grid-cols-1">
          {crackSteps.map((step, index) => (
            <li
              className={`flex min-h-28 flex-col justify-between rounded-lg p-5 font-extrabold ${
                crackPercent >= index * 25
                  ? "bg-[#191611] text-white"
                  : "border border-[#e6ded2] bg-white text-[#6f685e]"
              }`}
              key={step}
            >
              <span className="text-3xl text-[#3f88c5]">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="mx-auto w-[min(1120px,calc(100%-32px))] pb-20"
        id="deploy"
      >
        <SectionHeading eyebrow="Deploy Status" title="서비스 연결 상태" />
        <div className="grid gap-4 sm:grid-cols-2">
          <StatusPanel label="Frontend" value="Vercel 준비 완료" detail="Next.js" />
          <StatusPanel
            label="Backend"
            value={
              apiState.status === "online"
                ? "Render API 연결됨"
                : apiState.status === "checking"
                  ? "API 확인 중"
                  : "API 연결 대기"
            }
            detail={
              apiState.status === "online"
                ? `${apiState.service} / DB ${apiState.database}`
                : apiState.status === "checking"
                  ? healthUrl
                  : apiState.message
            }
          />
        </div>
      </section>
    </main>
  );
}

function WaxPreview({
  crackPoints,
  crackPercent,
  freezerMinutes,
  freezerState,
  isBroken,
  onCrack,
  selectedWax,
}: {
  crackPoints: CrackPoint[];
  crackPercent: number;
  freezerMinutes: number;
  freezerState: string;
  isBroken: boolean;
  onCrack: (event: MouseEvent<HTMLButtonElement>) => void;
  selectedWax: WaxType;
}) {
  return (
    <div className="wax-scene grid min-h-[430px] place-items-center max-md:min-h-[340px]">
      <div className="relative grid aspect-[1/1.08] w-[min(100%,420px)] place-items-center overflow-hidden rounded-lg border border-[#9ccce7] bg-[linear-gradient(145deg,rgba(255,255,255,0.82),rgba(218,242,250,0.72))] p-6 shadow-[0_22px_70px_rgba(63,136,197,0.18)]">
        <span className="absolute left-5 top-5 rounded-full border border-[#e6ded2] bg-white px-3 py-2 text-xs font-extrabold">
          {freezerMinutes}분 냉동 · {freezerState}
        </span>
        <button
          aria-label={`${selectedWax.name} 직접 깨기`}
          className={`wax-ball-3d group relative aspect-square w-[min(72%,270px)] cursor-pointer overflow-hidden rounded-full border-0 bg-gradient-to-br p-0 ${selectedWax.ballClassName} shadow-[inset_-38px_-46px_54px_rgba(0,0,0,0.34),inset_18px_20px_26px_rgba(255,255,255,0.2),0_34px_36px_rgba(58,36,25,0.27)] transition-transform active:scale-[0.97] ${isBroken ? "wax-ball-broken scale-95" : "hover:scale-[1.02]"}`}
          onClick={onCrack}
          type="button"
        >
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_24%,rgba(255,255,255,0.62),transparent_24%),radial-gradient(circle_at_68%_75%,rgba(0,0,0,0.24),transparent_38%)]" />
          <span className="wax-shell-texture absolute inset-0 rounded-full opacity-55" />
          <span className="absolute inset-[10%] rounded-full border-t-[12px] border-white/35 -rotate-[24deg]" />
          <span className="absolute left-[20%] top-[15%] h-[24%] w-[32%] rounded-full bg-white/25 blur-md" />
          <span className="absolute inset-[23%] rounded-full border border-white/20 shadow-[inset_0_0_24px_rgba(255,255,255,0.18)]" />
          {crackPoints.map((point, index) => (
            <span
              className="wax-crack-cluster absolute h-[46%] w-[4px] origin-top bg-[#fff8e9] shadow-[0_0_9px_rgba(255,248,233,0.95)]"
              key={point.id}
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
                transform: `rotate(${point.rotation}deg) scale(${0.82 + index * 0.05}) translateZ(34px)`,
              }}
            >
              <span className="absolute left-0 top-[24%] h-[46%] w-[2px] origin-top rotate-[38deg] bg-[#fff8e9]" />
              <span className="absolute left-0 top-[36%] h-[62%] w-[2px] origin-top rotate-[64deg] bg-[#fff8e9]" />
              <span className="absolute left-0 top-[54%] h-[48%] w-[2px] origin-top -rotate-[53deg] bg-[#fff8e9]" />
              {index > 1 ? (
                <span className="absolute left-0 top-[18%] h-[36%] w-[2px] origin-top -rotate-[76deg] bg-[#fff8e9]" />
              ) : null}
              {index > 3 ? (
                <span className="absolute left-0 top-[72%] h-[34%] w-[2px] origin-top rotate-[112deg] bg-[#fff8e9]" />
              ) : null}
            </span>
          ))}
          {isBroken ? (
            <>
              <span className="absolute inset-[25%] rounded-full bg-[radial-gradient(circle_at_42%_34%,#ffe8b1,#d99051_58%,#6f4528)] shadow-[inset_0_0_32px_rgba(91,52,24,0.48)]" />
              <span className="absolute inset-[36%] rounded-full bg-[#5f3b24]/80 shadow-[inset_0_0_18px_rgba(0,0,0,0.36)]" />
              <span className="absolute left-[29%] top-[22%] h-[55%] w-[10%] -rotate-[18deg] bg-[#fff8e9] shadow-[0_0_10px_rgba(255,248,233,0.75)]" />
              <span className="absolute right-[27%] top-[20%] h-[58%] w-[9%] rotate-[22deg] bg-[#fff8e9] shadow-[0_0_10px_rgba(255,248,233,0.75)]" />
              <span className="absolute left-[20%] top-[52%] h-[8%] w-[58%] rotate-[8deg] bg-[#fff8e9]/90" />
            </>
          ) : null}
        </button>
        {isBroken ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {Array.from({ length: 18 }, (_, index) => (
              <span
                className={`wax-fragment absolute left-1/2 top-1/2 h-7 w-10 ${selectedWax.chipClassName} shadow-[0_8px_12px_rgba(0,0,0,0.22)]`}
                key={index}
                style={{
                  "--fragment-angle": `${index * 20}deg`,
                  "--fragment-distance": `${96 + (index % 5) * 15}px`,
                  "--fragment-rotate": `${index * 43}deg`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        ) : null}
        <span className="absolute bottom-5 right-5 rounded-full border border-[#e6ded2] bg-white px-3 py-2 text-xs font-extrabold text-[#3f88c5]">
          {isBroken ? "완전 파괴 · 다시 클릭하면 소리 재생" : `${crackPercent}% 균열 · 공을 직접 클릭`}
        </span>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-7 max-w-3xl">
      <p className="mb-3 text-sm font-extrabold uppercase text-[#3f88c5]">
        {eyebrow}
      </p>
      <h2 className="text-4xl font-extrabold leading-tight sm:text-5xl">
        {title}
      </h2>
    </div>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e6ded2] bg-white p-4">
      <div className="text-sm font-extrabold text-[#6f685e]">{label}</div>
      <div className="mt-2 break-words text-xl font-extrabold">{value}</div>
    </div>
  );
}

function StatusPanel({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-[#e6ded2] bg-white p-6 shadow-sm">
      <div className="text-sm font-extrabold text-[#6f685e]">{label}</div>
      <div className="mt-4 text-2xl font-extrabold">{value}</div>
      <div className="mt-2 break-words text-sm leading-6 text-[#6f685e]">
        {detail}
      </div>
    </div>
  );
}
