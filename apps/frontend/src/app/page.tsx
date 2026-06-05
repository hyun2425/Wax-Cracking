"use client";

import Link from "next/link";
import {
  type MouseEvent,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as THREE from "three";

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
  force: number;
};

type ThreePalette = {
  clay: number;
  crack: number;
  patch: number;
  patchColors: number[];
  shell: number;
  shellOpacity: number;
  style: "dubai" | "cotton" | "apple";
};

type ShellPieceSpec = {
  height: number;
  id: number;
  rotation: number;
  width: number;
  x: number;
  y: number;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8080";

const waxTypes: WaxType[] = [
  {
    name: "두바이 왁뿌볼",
    description: "매끈한 초콜릿 코팅 안에 진한 피스타치오 클레이가 들어 있는 왁뿌볼입니다.",
    tone: "묵직한 파열음",
    accent: "고급스럽고 단단한 이미지",
    ballClassName: "from-[#2d1c15] via-[#7b4b31] to-[#d7a948]",
    chipClassName: "bg-[#d7a948]",
    frequency: 150,
  },
  {
    name: "솜사탕 왁뿌볼",
    description: "분홍, 하늘, 연노랑 색이 부드럽게 섞이는 말랑한 왁뿌볼입니다.",
    tone: "가벼운 바스락 소리",
    accent: "부드럽고 가벼운 이미지",
    ballClassName: "from-[#f08aa9] via-[#98d8ef] to-[#a487df]",
    chipClassName: "bg-[#f08aa9]",
    frequency: 310,
  },
  {
    name: "청사과 왁뿌볼",
    description: "선명한 연두색 유광 코팅이 시원하게 보이는 왁뿌볼입니다.",
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
const referenceCrunchUrl = "/sounds/wax-crunch-reference.mp3";

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
  const fractureThreshold = 15;
  const crackPercent = Math.min(100, Math.round((crackProgress / fractureThreshold) * 100));
  const isBroken = crackPercent >= 100;

  const playReferenceCrunch = useCallback((isFinal = false) => {
    const audio = new Audio(referenceCrunchUrl);
    const freezerVolume = 0.32 + (freezerMinutes / 20) * 0.58;
    audio.volume = Math.min(1, freezerVolume + (isFinal ? 0.12 : 0));
    audio.playbackRate = isFinal ? 0.96 : 1.04;

    audio.addEventListener(
      "loadedmetadata",
      () => {
        const playableDuration = Math.max(0, audio.duration - 2);
        audio.currentTime = playableDuration > 0 ? Math.random() * playableDuration : 0;
        void audio.play().catch(() => {
          // Keep the generated crunch layer as a fallback if the sample is blocked.
        });
        window.setTimeout(() => {
          audio.pause();
          audio.currentTime = 0;
        }, 1000);
      },
      { once: true },
    );
  }, [freezerMinutes]);

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
    playReferenceCrunch(isFinal);
  }, [playReferenceCrunch]);

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
    const rect = event.currentTarget.getBoundingClientRect();
    const next = crackProgress + 1;
    const isFinal = next >= fractureThreshold;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const force = 0.72 + freezerMinutes / 24 + next / fractureThreshold / 2.2;

    setCrackPoints((current) => [
      ...current,
      {
        id: Date.now() + current.length,
        x,
        y,
        rotation: (current.length * 47 + Math.round(x - y)) % 126 - 63,
        force,
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
            <Link href="/">mk.ver</Link>
            <Link href="/hsj-ver">hsj.ver</Link>
            <Link href="/njjey-ver">njjey.ver</Link>
          </div>
        </nav>

        <section className="mx-auto grid w-[min(1120px,calc(100%-32px))] grid-cols-[minmax(0,1fr)_minmax(320px,0.86fr)] items-center gap-14 py-16 max-md:grid-cols-1">
          <div>
            <p className="mb-3 text-sm font-extrabold uppercase text-[#3f88c5]">
              ASMR Simulation Service
            </p>
            <h1 className="max-w-3xl whitespace-nowrap text-5xl font-extrabold leading-none text-[#191611] sm:text-6xl lg:text-7xl">
              온라인 왁뿌볼
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#6f685e]">
              왁뿌볼을 고르고 냉동실에 넣은 뒤 마우스로 눌러 깨뜨리는
              반복 플레이형 ASMR 시뮬레이션입니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
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
          <SectionHeading eyebrow="Play" title="왁뿌볼 깨기 체험" />

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
            <StatusMetric label="선택한 왁뿌볼" value={selectedWax.name} />
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
            위쪽 왁뿌볼을 직접 클릭해서 깨뜨려 보세요. 마지막 균열에서 파괴음이 재생됩니다.
          </p>
        </div>
      </section>

      <section
        className="mx-auto w-[min(1120px,calc(100%-32px))] py-20"
        id="features"
      >
        <SectionHeading eyebrow="Wax Ball Types" title="선택 가능한 왁뿌볼" />
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
    <div className="grid min-h-[460px] place-items-center max-md:min-h-[360px]">
      <div className="relative aspect-[1/1.08] w-[min(100%,440px)] overflow-hidden rounded-lg border border-[#e1d7ca] bg-[#f7f1e9] shadow-[0_24px_70px_rgba(90,72,54,0.18)]">
        <span className="absolute left-5 top-5 z-10 rounded-full border border-[#dfd2c4] bg-white/75 px-3 py-2 text-xs font-extrabold text-[#3b3128] backdrop-blur">
          {freezerMinutes}분 냉동 · {freezerState}
        </span>
        <button
          aria-label={`${selectedWax.name} 직접 깨기`}
          className="absolute inset-0 cursor-pointer border-0 bg-transparent p-0"
          onClick={onCrack}
          type="button"
        >
          <ThreeWaxBall
            crackPoints={crackPoints}
            freezerMinutes={freezerMinutes}
            isBroken={isBroken}
            selectedWax={selectedWax}
          />
        </button>
        <span className="absolute bottom-5 right-5 z-10 rounded-full border border-[#dfd2c4] bg-white/75 px-3 py-2 text-xs font-extrabold text-[#4d8a10] backdrop-blur">
          {isBroken ? "완전 파괴 · 콰작 다시 듣기" : `${crackPercent}% 균열 · 3D 공 직접 클릭`}
        </span>
      </div>
    </div>
  );
}

function ThreeWaxBall({
  crackPoints,
  freezerMinutes,
  isBroken,
  selectedWax,
}: {
  crackPoints: CrackPoint[];
  freezerMinutes: number;
  isBroken: boolean;
  selectedWax: WaxType;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }
    const mountElement = mount;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xf8f3ec, 8, 18);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 0.15, 7.8);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.width = "100%";
    mountElement.appendChild(renderer.domElement);

    const root = new THREE.Group();
    root.rotation.set(-0.1, -0.25, 0.03);
    scene.add(root);

    const palette = getThreePalette(selectedWax.name);
    const fractureAmount = Math.min(1, crackPoints.length / 15);
    const pressAmount = Math.min(0.16, crackPoints.length * 0.025);
    const ballGeometry = new THREE.SphereGeometry(1.42, 72, 48);
    if (palette.style === "cotton") {
      applyCottonMarbleColors(ballGeometry);
    }
    applyPressedClayDeformation(ballGeometry, crackPoints);
    const fractureTexture = fractureAmount > 0 ? makeFractureTexture(palette.style, crackPoints.length) : null;
    const shellMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: fractureAmount > 0 ? (palette.style === "apple" ? 0 : palette.style === "dubai" ? 0.35 : 0.45) : 1,
      clearcoatRoughness: fractureAmount > 0 ? (palette.style === "apple" ? 0.75 : 0.2) : 0.045,
      color: fractureTexture ? 0xffffff : palette.shell,
      map: fractureTexture,
      metalness: 0.02,
      opacity: 1,
      roughness: fractureAmount > 0 ? (palette.style === "apple" ? 0.92 : 0.32) : palette.style === "apple" ? 0.045 : palette.style === "dubai" ? 0.08 : 0.06,
      sheen: palette.style === "apple" && fractureAmount > 0 ? 0 : 0.35,
      transparent: false,
      transmission: 0,
      vertexColors: palette.style === "cotton" && !fractureTexture,
    });

    const ball = new THREE.Mesh(
      ballGeometry,
      shellMaterial,
    );
    ball.castShadow = true;
    ball.receiveShadow = true;
    root.add(ball);

    const clearOuterShell = new THREE.Mesh(
      new THREE.SphereGeometry(1.58, 160, 96),
      new THREE.MeshPhysicalMaterial({
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        color: 0xf5fdff,
        depthWrite: false,
        opacity: fractureAmount > 0 ? 0.085 : palette.style === "dubai" ? 0.1 : palette.style === "cotton" ? 0.24 : 0.18,
        roughness: 0.035,
        side: THREE.FrontSide,
        transparent: true,
        transmission: 0.62,
      }),
    );
    clearOuterShell.castShadow = false;
    clearOuterShell.renderOrder = 3;
    root.add(clearOuterShell);

    const innerClay = new THREE.Mesh(
      new THREE.SphereGeometry(1.02, 48, 32),
      new THREE.MeshPhysicalMaterial({
        clearcoat: 0.25,
        color: palette.clay,
        roughness: 0.58,
      }),
    );
    innerClay.visible = false;
    innerClay.castShadow = true;
    root.add(innerClay);

    const neckMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.8,
      clearcoatRoughness: 0.08,
      color: 0xf2f0e9,
      opacity: 0.46,
      roughness: 0.18,
      transparent: true,
      transmission: 0.38,
    });
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.27, 0.54, 14),
      neckMaterial,
    );
    stem.position.set(0.08, 1.52, 0.16);
    stem.rotation.set(0.28, -0.16, 0.08);
    stem.scale.set(0.82, 1, 0.68);
    stem.castShadow = true;
    root.add(stem);

    const cableTie = new THREE.Mesh(
      new THREE.TorusGeometry(0.23, 0.028, 10, 42),
      new THREE.MeshStandardMaterial({
        color: 0xe9edf0,
        metalness: 0.02,
        roughness: 0.34,
      }),
    );
    cableTie.position.set(0.09, 1.35, 0.16);
    cableTie.rotation.set(1.42, -0.2, 0.08);
    root.add(cableTie);

    const cableTieTail = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.42, 0.035),
      new THREE.MeshStandardMaterial({
        color: 0xe9edf0,
        roughness: 0.4,
      }),
    );
    cableTieTail.position.set(0.36, 1.37, 0.18);
    cableTieTail.rotation.set(0.22, 0.02, -0.68);
    root.add(cableTieTail);

    const crimpMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.65,
      clearcoatRoughness: 0.12,
      color: 0xf6f1e8,
      opacity: 0.66,
      roughness: 0.22,
      transparent: true,
      transmission: 0.22,
    });
    const tiePinch = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 10), crimpMaterial);
    tiePinch.position.set(0.08, 1.39, 0.17);
    tiePinch.scale.set(1.35, 0.48, 0.8);
    tiePinch.rotation.set(0.2, -0.18, 0.08);
    root.add(tiePinch);

    [-0.16, -0.05, 0.07, 0.18].forEach((offset, index) => {
      const fold = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.34, 0.034), crimpMaterial);
      fold.position.set(0.06 + offset, 1.5 + index * 0.012, 0.2);
      fold.rotation.set(0.38, -0.14 + index * 0.07, -0.28 + index * 0.18);
      root.add(fold);
    });

    const knotShadow = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.018, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x8aa2aa, opacity: 0.22, transparent: true }),
    );
    knotShadow.position.set(0.08, 1.32, 0.15);
    knotShadow.rotation.set(1.46, -0.16, 0.04);
    root.add(knotShadow);

    const fractureGroup = new THREE.Group();
    root.add(fractureGroup);
    if (fractureAmount > 0 && crackPoints.length > 999) {
      const firstImpact = crackPoints[0];
      const impactCenter = firstImpact
        ? new THREE.Vector2(
            THREE.MathUtils.clamp((firstImpact.x - 50) / 35, -0.9, 0.9),
            THREE.MathUtils.clamp(-(firstImpact.y - 50) / 35, -0.85, 0.85),
          )
        : new THREE.Vector2(0, 0);
      const pieceSpecs = buildSubdividedShellPieces(palette.style, crackPoints.length, impactCenter);
      const gapScale = 1 - Math.min(0.22, Math.max(0, crackPoints.length - 1) * 0.02);
      const makeShellMaterial = () =>
        new THREE.MeshPhysicalMaterial({
          clearcoat: 1,
          clearcoatRoughness: palette.style === "apple" ? 0.06 : 0.035,
          color: palette.shell,
          depthTest: false,
          depthWrite: true,
          opacity: 1,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
          roughness: palette.style === "apple" ? 0.045 : 0.085,
          side: THREE.DoubleSide,
          transparent: false,
          transmission: 0,
          vertexColors: false,
      });
      const highlightMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        opacity: palette.style === "apple" ? 0.14 : palette.style === "dubai" ? 0.16 : 0.22,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      pieceSpecs.forEach(({ height, id, rotation, width, x, y }, index) => {
        const direction = new THREE.Vector3(x || 0.01, y || 0.01, 0).normalize();
        const separation = fractureAmount * (0.0018 + Math.min(index, 18) * 0.00008);
        const pressOffset = getPressOffsetForPiece(x, y, crackPoints);
        const shellGeometry = makeSurfacePatchGeometry({
          centerX: x + direction.x * separation,
          centerY: y + direction.y * separation,
          height: height * gapScale,
          pressOffset,
          radius: 1.49,
          rotation,
          seed: id,
          width: width * gapScale,
        });
        const shellPiece = new THREE.Mesh(shellGeometry, makeShellMaterial());
        shellPiece.renderOrder = 1;
        shellPiece.castShadow = false;
        shellPiece.scale.setScalar(0.42);
        fractureGroup.add(shellPiece);

        if (index % 4 === 0) {
          const glintGeometry = makeSurfacePatchGeometry({
            centerX: x + direction.x * separation - width * 0.08,
            centerY: y + direction.y * separation + height * 0.08,
            height: height * gapScale * 0.22,
            pressOffset: pressOffset - 0.004,
            radius: 1.5,
            rotation: rotation - 0.18,
            seed: id + 500,
            width: width * gapScale * 0.3,
          });
          const glint = new THREE.Mesh(glintGeometry, highlightMaterial);
          glint.renderOrder = 4;
          fractureGroup.add(glint);
        }
      });
    }

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.55, 72),
      new THREE.MeshBasicMaterial({
        color: 0xd8d1ca,
        transparent: true,
        opacity: 0.24,
      }),
    );
    floor.position.set(0, -1.86, -0.2);
    floor.rotation.x = -Math.PI / 2;
    floor.scale.set(1.35, 0.38, 1);
    scene.add(floor);

    const keyLight = new THREE.DirectionalLight(0xffffff, palette.style === "apple" && fractureAmount > 0 ? 2.05 : 3.2);
    keyLight.position.set(3.6, 4.2, 5.8);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xc8f7ff, palette.style === "apple" && fractureAmount > 0 ? 1.15 : 2.2);
    rimLight.position.set(-3.8, 1.8, 3.2);
    scene.add(rimLight);

    const warmLight = new THREE.PointLight(0xfff1dd, palette.style === "apple" && fractureAmount > 0 ? 2.1 : 4.8, 9);
    warmLight.position.set(-2.8, -2.1, 3.4);
    scene.add(warmLight);
    scene.add(new THREE.HemisphereLight(0xfff7ed, 0xd8e8f0, palette.style === "apple" && fractureAmount > 0 ? 0.85 : 1.45));

    let animationId = 0;
    const start = performance.now();

    function resize() {
      const rect = mountElement.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      root.scale.setScalar(width < 380 ? 0.76 : 0.92);
    }

    function animate() {
      const elapsed = (performance.now() - start) / 1000;
      root.rotation.y = -0.24 + Math.sin(elapsed * 0.55) * 0.12;
      root.rotation.x = -0.08 + Math.sin(elapsed * 0.42) * 0.05;
      const pressedScale = new THREE.Vector3(
        1 + pressAmount * 0.42,
        1 - pressAmount * 0.68,
        1 + pressAmount * 0.04,
      );
      ball.scale.lerp(
        pressedScale,
        0.08,
      );
      clearOuterShell.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      innerClay.scale.lerp(pressedScale, 0.08);
      renderer.render(scene, camera);
      animationId = window.requestAnimationFrame(animate);
    }

    resize();
    animate();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(animationId);
      renderer.dispose();
      mountElement.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) {
            material.forEach((item) => item.dispose());
          } else {
            material.dispose();
          }
        }
      });
    };
  }, [crackPoints, freezerMinutes, isBroken, selectedWax.name]);

  return <div ref={mountRef} className="h-full w-full" />;
}

function getThreePalette(name: string) {
  if (name.includes("두바이")) {
    return {
      clay: 0xc7d88a,
      crack: 0xc7d88a,
      patch: 0x5b3424,
      patchColors: [0x4a2618, 0x62341f, 0x7a4328, 0x2f1a12],
      shell: 0x2b1710,
      shellOpacity: 1,
      style: "dubai",
    } satisfies ThreePalette;
  }

  if (name.includes("솜사탕")) {
    return {
      clay: 0xf4d8c6,
      crack: 0xf4d8c6,
      patch: 0xf7a8c6,
      patchColors: [0xf7a8c6, 0xa8dcf3, 0xf4e6a8],
      shell: 0xffffff,
      shellOpacity: 0.96,
      style: "cotton",
    } satisfies ThreePalette;
  }

  return {
    clay: 0xefe7d7,
    crack: 0xffffff,
    patch: 0x8ce000,
    patchColors: [0x8fd10a, 0x9ee32d, 0x6fb800],
    shell: 0x8eea22,
    shellOpacity: 0.86,
    style: "apple",
  } satisfies ThreePalette;
}

function makeFractureTexture(style: ThreePalette["style"], clickCount: number) {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const progress = THREE.MathUtils.clamp((clickCount - 1) / 14, 0, 1);

  if (style === "cotton") {
    context.fillStyle = "#f7b6d2";
    context.fillRect(0, 0, size, size);
    context.globalAlpha = 0.86;
    [
      ["#b7eef7", 0.28, 0.36, 0.46],
      ["#b7eef7", 0.72, 0.18, 0.34],
      ["#fdeca6", 0.56, 0.7, 0.34],
      ["#f7b6d2", 0.78, 0.66, 0.36],
    ].forEach(([color, x, y, radius]) => {
      const glow = context.createRadialGradient(
        Number(x) * size,
        Number(y) * size,
        0,
        Number(x) * size,
        Number(y) * size,
        Number(radius) * size,
      );
      glow.addColorStop(0, String(color));
      glow.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, size, size);
    });
    context.globalAlpha = 0.24;
    context.fillStyle = "#fff8ef";
    context.fillRect(0, 0, size, size);
    context.globalAlpha = 1;
  } else {
    context.fillStyle = style === "dubai" ? "#c7d88a" : "#efe7d7";
    context.fillRect(0, 0, size, size);
  }

  const waxColors =
    style === "dubai"
      ? ["#2f1a12", "#4a2618", "#62341f", "#7a4328"]
      : style === "cotton"
        ? ["rgba(255,248,239,0.86)", "rgba(255,250,243,0.78)", "rgba(250,244,236,0.82)"]
        : ["#7dd90e", "#8eea22", "#9af52a", "#6fc600"];
  let fragments = getTextureBaseFragments();

  const random = (seed: number) => {
    const raw = Math.sin(seed * 91.731) * 47453.5453;
    return raw - Math.floor(raw);
  };

  for (let step = 2; step <= Math.min(clickCount, 15); step += 1) {
    const splitCount = step < 6 ? 2 : 3;
    const selected = new Set(
      fragments
        .map((fragment, index) => ({
          area: fragment.width * fragment.height,
          fragment,
          index,
          score: Math.abs(Math.sin(fragment.id * 2.93 + step * 1.37)) - fragment.width * fragment.height * 2.8,
        }))
        .sort((left, right) => left.score - right.score || right.area - left.area)
        .slice(0, splitCount)
        .map(({ fragment }) => fragment.id),
    );

    fragments = fragments.flatMap((fragment) => (selected.has(fragment.id) ? splitTextureFragment(fragment, step) : [fragment]));
  }

  fragments.forEach(({ height, rotation, u, v, width }, index) => {
    const points = 6 + (index % 3);
    const centerX = u * size;
    const centerY = v * size;
    const coverageScale = (style === "cotton" ? 0.5 : 0.78) * (1 - progress * 0.16);
    const radiusX = width * size * coverageScale * (0.8 + random(index + 2) * 0.24);
    const radiusY = height * size * coverageScale * (0.76 + random(index + 7) * 0.22);
    const rotated = rotation + random(index + 19) * 0.28;

    context.save();
    context.translate(centerX, centerY);
    context.rotate(rotated);
    context.shadowColor =
      style === "dubai"
        ? "rgba(30,18,10,0.36)"
        : style === "cotton"
          ? "rgba(104,76,68,0.34)"
          : "rgba(80,72,58,0.18)";
    context.shadowBlur = style === "apple" ? 8 : style === "cotton" ? 12 : 12;
    context.shadowOffsetY = style === "cotton" ? 8 : 6;
    context.beginPath();

    for (let point = 0; point <= points; point += 1) {
      const angle = (point / points) * Math.PI * 2;
      const wobble = 0.76 + random(index * 17 + point * 3) * 0.34;
      const x = Math.cos(angle) * radiusX * wobble;
      const y = Math.sin(angle) * radiusY * (0.78 + random(index * 23 + point) * 0.22);
      if (point === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }

    context.closePath();
    context.fillStyle = waxColors[index % waxColors.length];
    context.fill();
    context.shadowColor = "transparent";
    context.lineJoin = "miter";
    context.lineWidth = (style === "cotton" ? 12 : 11) + progress * 10;
    context.strokeStyle =
      style === "dubai"
        ? "rgba(199,216,138,0.55)"
        : style === "cotton"
          ? "rgba(247,182,210,0.64)"
          : "rgba(239,231,215,0.5)";
    context.stroke();
    context.shadowColor = "transparent";
    context.globalAlpha = style === "cotton" ? 0.16 : style === "dubai" ? 0.28 : 0.32;
    context.fillStyle = "rgba(255,255,255,0.72)";
    context.scale(0.58, 0.36);
    context.translate(-radiusX * 0.28, -radiusY * 0.4);
    context.beginPath();
    context.ellipse(0, 0, radiusX * 0.5, radiusY * 0.32, -0.35, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

type TextureFragment = {
  height: number;
  id: number;
  rotation: number;
  u: number;
  v: number;
  width: number;
};

function getTextureBaseFragments(): TextureFragment[] {
  return [
    [0.18, 0.22, 0.23, 0.17, -0.32],
    [0.48, 0.18, 0.25, 0.16, 0.18],
    [0.78, 0.24, 0.23, 0.18, 0.46],
    [0.12, 0.48, 0.22, 0.2, -0.58],
    [0.4, 0.46, 0.29, 0.2, 0.28],
    [0.7, 0.48, 0.27, 0.2, -0.18],
    [0.9, 0.56, 0.2, 0.18, 0.34],
    [0.24, 0.74, 0.24, 0.16, 0.12],
    [0.54, 0.78, 0.28, 0.16, -0.4],
    [0.8, 0.76, 0.22, 0.17, 0.18],
  ].map(([u, v, width, height, rotation], index) => ({
    height,
    id: index + 1,
    rotation,
    u,
    v,
    width,
  }));
}

function splitTextureFragment(fragment: TextureFragment, step: number): TextureFragment[] {
  const splitVertical = (fragment.id + step) % 2 === 0;
  const offset = splitVertical ? fragment.width * 0.17 : fragment.height * 0.17;
  const rotationOffset = 0.18 + ((fragment.id + step) % 3) * 0.04;

  if (splitVertical) {
    return [
      {
        ...fragment,
        id: fragment.id * 2 + step,
        rotation: fragment.rotation - rotationOffset,
        u: THREE.MathUtils.clamp(fragment.u - offset, 0.035, 0.965),
        width: fragment.width * 0.58,
      },
      {
        ...fragment,
        id: fragment.id * 2 + step + 1,
        rotation: fragment.rotation + rotationOffset,
        u: THREE.MathUtils.clamp(fragment.u + offset * 0.95, 0.035, 0.965),
        width: fragment.width * 0.54,
      },
    ];
  }

  return [
    {
      ...fragment,
      height: fragment.height * 0.58,
      id: fragment.id * 2 + step,
      rotation: fragment.rotation - rotationOffset,
      v: THREE.MathUtils.clamp(fragment.v - offset, 0.055, 0.945),
    },
    {
      ...fragment,
      height: fragment.height * 0.54,
      id: fragment.id * 2 + step + 1,
      rotation: fragment.rotation + rotationOffset,
      v: THREE.MathUtils.clamp(fragment.v + offset * 0.95, 0.055, 0.945),
    },
  ];
}

function getPressCenters(crackPoints: CrackPoint[]) {
  return crackPoints.slice(-8).map((point, index) => ({
    force: Math.min(1.45, point.force) * (0.72 + index * 0.045),
    x: THREE.MathUtils.clamp((point.x - 50) / 35, -1, 1),
    y: THREE.MathUtils.clamp(-(point.y - 50) / 35, -0.95, 0.95),
  }));
}

function getPressOffsetForPiece(x: number, y: number, crackPoints: CrackPoint[]) {
  return getPressCenters(crackPoints).reduce((offset, point) => {
    const distanceSq = (x - point.x) ** 2 + (y - point.y) ** 2;
    return offset + Math.exp(-distanceSq / 0.2) * 0.03 * point.force;
  }, 0);
}

function getFrontSurfaceZ(x: number, y: number, radius: number) {
  return Math.sqrt(Math.max(0.08, radius * radius - x * x - y * y));
}

function makeSurfacePatchGeometry({
  centerX,
  centerY,
  height,
  pressOffset,
  radius,
  rotation,
  seed,
  width,
}: {
  centerX: number;
  centerY: number;
  height: number;
  pressOffset: number;
  radius: number;
  rotation: number;
  seed: number;
  width: number;
}) {
  const random = (value: number) => {
    const raw = Math.sin(seed * 37.17 + value * 19.91) * 43758.5453;
    return raw - Math.floor(raw);
  };
  const pointCount = 5 + (seed % 2);
  const localPoints = Array.from({ length: pointCount }, (_, index) => {
    const angle =
      (Math.PI * 2 * index) / pointCount +
      (random(index + 1) - 0.5) * 0.18;
    const radiusX = width * (0.43 + random(index + 11) * 0.12);
    const radiusY = height * (0.41 + random(index + 21) * 0.12);
    return [Math.cos(angle) * radiusX, Math.sin(angle) * radiusY];
  });
  const wobble = (value: number) => (random(value) - 0.5) * 0.08;
  const roundedPoints: number[][] = [];
  localPoints.forEach(([startX, startY], index) => {
    const [endX, endY] = localPoints[(index + 1) % localPoints.length];
    for (let step = 0; step < 3; step += 1) {
      const t = step / 3;
      const x = THREE.MathUtils.lerp(startX, endX, t);
      const y = THREE.MathUtils.lerp(startY, endY, t);
      const bulge = Math.sin(t * Math.PI) * (0.008 + Math.abs(wobble(index + step + 18)) * 0.008);
      const edgeLength = Math.hypot(endX - startX, endY - startY) || 1;
      const normalX = -(endY - startY) / edgeLength;
      const normalY = (endX - startX) / edgeLength;
      roundedPoints.push([x + normalX * bulge, y + normalY * bulge]);
    }
  });
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const edgeLimit = radius * 0.99;
  const vertices: number[] = [];
  const normals: number[] = [];
  const radialDistance = Math.hypot(centerX, centerY);
  const radialClamp = radialDistance > edgeLimit ? edgeLimit / radialDistance : 1;
  const safeCenterX = centerX * radialClamp;
  const safeCenterY = centerY * radialClamp;
  const edgeRatio = THREE.MathUtils.clamp(Math.hypot(safeCenterX, safeCenterY) / edgeLimit, 0, 1);
  const curvatureScale = 1 - edgeRatio * edgeRatio * 0.46;
  const surfaceOffset = 0.017 - edgeRatio * 0.012;
  const centerZ = getFrontSurfaceZ(safeCenterX, safeCenterY, radius) + surfaceOffset - pressOffset;

  vertices.push(safeCenterX, safeCenterY, centerZ);
  normals.push(safeCenterX / radius, safeCenterY / radius, getFrontSurfaceZ(safeCenterX, safeCenterY, radius) / radius);

  roundedPoints.forEach(([localX, localY]) => {
    const rotatedX = (localX * cos - localY * sin) * curvatureScale;
    const rotatedY = (localX * sin + localY * cos) * curvatureScale;
    const rawX = safeCenterX + rotatedX;
    const rawY = safeCenterY + rotatedY;
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > edgeLimit ? edgeLimit / distance : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    const sphereZ = getFrontSurfaceZ(x, y, radius);
    const z = sphereZ + surfaceOffset - pressOffset;
    vertices.push(x, y, z);
    normals.push(x / radius, y / radius, sphereZ / radius);
  });

  const indices: number[] = [];
  for (let index = 1; index <= roundedPoints.length; index += 1) {
    indices.push(0, index, index === roundedPoints.length ? 1 : index + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

function applyPressedClayDeformation(geometry: THREE.BufferGeometry, crackPoints: CrackPoint[]) {
  if (crackPoints.length === 0) {
    return;
  }

  const centers = getPressCenters(crackPoints);
  const position = geometry.getAttribute("position");

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);

    if (z < 0.2) {
      continue;
    }

    let dent = 0;
    const edgeFalloff = THREE.MathUtils.smoothstep(1.18 - Math.sqrt(x * x + y * y), 0, 0.34);

    centers.forEach((point) => {
      const dx = x - point.x;
      const dy = y - point.y;
      const influence = Math.exp(-(dx * dx + dy * dy) / 0.26) * point.force * edgeFalloff;
      dent += influence * 0.085;
    });

    position.setXYZ(
      index,
      x,
      y,
      Math.max(1.14, z - dent),
    );
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

function getBaseShellPieces(style: ThreePalette["style"]): ShellPieceSpec[] {
  const scale = style === "dubai" ? 1.18 : style === "cotton" ? 1.12 : 1.12;
  const startId = style === "dubai" ? 1 : style === "cotton" ? 40 : 80;
  const layout = [
    [-0.08, 0.12, 0.56, 0.44, 0.2],
    [-0.58, 0.36, 0.5, 0.42, -0.38],
    [0.48, 0.42, 0.5, 0.4, 0.34],
    [-0.42, -0.34, 0.48, 0.42, 0.48],
    [0.46, -0.32, 0.5, 0.42, -0.18],
    [-0.02, -0.58, 0.54, 0.38, 0.06],
    [-0.12, 0.68, 0.52, 0.38, -0.08],
    [-0.98, 0.62, 0.44, 0.34, -0.48],
    [-0.54, 0.96, 0.42, 0.32, 0.28],
    [0.26, 1.02, 0.44, 0.32, -0.12],
    [0.92, 0.68, 0.42, 0.34, 0.54],
    [1.12, 0.12, 0.4, 0.38, -0.34],
    [0.94, -0.48, 0.42, 0.36, 0.2],
    [0.54, -0.98, 0.44, 0.32, -0.44],
    [-0.2, -1.1, 0.42, 0.32, 0.36],
    [-0.82, -0.76, 0.42, 0.34, -0.16],
    [-1.12, -0.2, 0.4, 0.38, 0.4],
    [-1.24, 0.22, 0.38, 0.34, -0.22],
    [1.24, -0.18, 0.38, 0.34, 0.16],
    [0.02, 1.28, 0.36, 0.28, 0.08],
    [0.06, -1.3, 0.36, 0.28, -0.18],
    [-0.94, 0.02, 0.38, 0.3, 0.12],
    [0.76, 0.02, 0.4, 0.32, -0.08],
    [0.06, -0.02, 0.42, 0.32, -0.34],
  ];

  return layout.map(([x, y, width, height, rotation], index) => ({
    height: height * scale,
    id: startId + index,
    rotation,
    width: width * scale,
    x,
    y,
  }));
}

function buildSubdividedShellPieces(style: ThreePalette["style"], clickCount: number, impactCenter: THREE.Vector2) {
  const maxPieces = style === "dubai" ? 34 : style === "cotton" ? 38 : 40;
  let pieces = getBaseShellPieces(style).map((piece) => ({ ...piece }));

  for (let step = 2; step <= clickCount && pieces.length < maxPieces; step += 1) {
    const splitCount = Math.min(style === "dubai" ? 3 : 4, maxPieces - pieces.length);
    const ordered = pieces
      .map((piece, index) => {
        const impactDistance = new THREE.Vector2(piece.x, piece.y).distanceTo(impactCenter);
        const edgeBonus = Math.min(1, Math.hypot(piece.x, piece.y));
        const wholeBallOrder =
          Math.abs(Math.sin(piece.id * 4.81 + step * 1.73)) -
          edgeBonus * 0.24 +
          impactDistance * 0.01 +
          index * 0.004;
        return {
          piece,
          score: wholeBallOrder,
        };
      })
      .sort((left, right) => {
        const leftArea = left.piece.width * left.piece.height;
        const rightArea = right.piece.width * right.piece.height;
        return left.score - right.score || rightArea - leftArea;
      });
    const selectedIds = new Set(ordered.slice(0, splitCount).map(({ piece }) => piece.id));
    const nextPieces: ShellPieceSpec[] = [];

    pieces.forEach((piece) => {
      if (selectedIds.has(piece.id)) {
        nextPieces.push(...splitShellPiece(piece, step));
      } else {
        nextPieces.push(piece);
      }
    });
    pieces = nextPieces;
  }

  return pieces;
}

function splitShellPiece(piece: ShellPieceSpec, step: number): ShellPieceSpec[] {
  const splitVertical = (piece.id + step) % 2 === 0;
  const offset = splitVertical ? piece.width * 0.18 : piece.height * 0.18;
  const rotationOffset = 0.08 + ((piece.id + step) % 3) * 0.025;

  if (splitVertical) {
    return [
      {
        ...piece,
        id: piece.id * 2 + step,
        width: piece.width * 0.58,
        x: piece.x - offset,
        rotation: piece.rotation - rotationOffset,
      },
      {
        ...piece,
        id: piece.id * 2 + step + 1,
        width: piece.width * 0.52,
        x: piece.x + offset * 0.9,
        rotation: piece.rotation + rotationOffset,
      },
    ];
  }

  return [
    {
      ...piece,
      height: piece.height * 0.58,
      id: piece.id * 2 + step,
      rotation: piece.rotation - rotationOffset,
      y: piece.y - offset,
    },
    {
      ...piece,
      height: piece.height * 0.52,
      id: piece.id * 2 + step + 1,
      rotation: piece.rotation + rotationOffset,
      y: piece.y + offset * 0.9,
    },
  ];
}

function applyCottonMarbleColors(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const colors: number[] = [];
  const pink = new THREE.Color(0xf7a8c6);
  const sky = new THREE.Color(0xa8dcf3);
  const cream = new THREE.Color(0xf4e6a8);
  const temp = new THREE.Color();

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const angle = Math.atan2(y, x) + Math.sin(z * 3.4) * 0.38 + Math.sin((x + y) * 2.2) * 0.18;
    const pinkWeight = Math.max(0.02, Math.cos(angle) + 0.42);
    const skyWeight = Math.max(0.02, Math.cos(angle - (Math.PI * 2) / 3) + 0.42);
    const creamWeight = Math.max(0.02, Math.cos(angle + (Math.PI * 2) / 3) + 0.42);
    const total = pinkWeight + skyWeight + creamWeight;

    temp
      .copy(pink)
      .multiplyScalar(pinkWeight / total)
      .add(sky.clone().multiplyScalar(skyWeight / total))
      .add(cream.clone().multiplyScalar(creamWeight / total));
    colors.push(temp.r, temp.g, temp.b);
  }

  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
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
