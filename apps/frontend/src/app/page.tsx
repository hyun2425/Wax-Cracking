"use client";

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

type ImpactPoint = {
  x: number;
  y: number;
  id: number;
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
  const [impactPoint, setImpactPoint] = useState<ImpactPoint | null>(null);
  const [apiState, setApiState] = useState<ApiState>({ status: "checking" });

  const selectedWax = waxTypes[selectedIndex];
  const freezerState = getFreezerState(freezerMinutes);
  const healthUrl = useMemo(() => `${apiBaseUrl}/api/health`, []);
  const requiredClicks = Math.max(3, 8 - Math.floor(freezerMinutes / 4));
  const crackPercent = Math.min(100, Math.round((crackProgress / requiredClicks) * 100));
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
    setImpactPoint(null);
  }

  function handleStartFreezer() {
    setCrackProgress(0);
    setCrackPoints([]);
    setImpactPoint(null);
    setIsFreezing(true);
  }

  function handleReset() {
    setFreezerMinutes(0);
    setIsFreezing(false);
    setCrackProgress(0);
    setCrackPoints([]);
    setImpactPoint(null);
  }

  function handleCrack(event: MouseEvent<HTMLButtonElement>) {
    if (isBroken) {
      playCrackSound(true);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const next = Math.min(requiredClicks, crackProgress + 1);
    const isFinal = next >= requiredClicks;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const force = 0.82 + freezerMinutes / 22 + next / requiredClicks / 3;

    setImpactPoint({ id: Date.now(), x, y });
    window.setTimeout(() => {
      setImpactPoint(null);
    }, 210);

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
            <a href="#simulator">시뮬레이터</a>
            <a href="#features">왁뿌볼</a>
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
            impactPoint={impactPoint}
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
  impactPoint,
  isBroken,
  onCrack,
  selectedWax,
}: {
  crackPoints: CrackPoint[];
  crackPercent: number;
  freezerMinutes: number;
  freezerState: string;
  impactPoint: ImpactPoint | null;
  isBroken: boolean;
  onCrack: (event: MouseEvent<HTMLButtonElement>) => void;
  selectedWax: WaxType;
}) {
  return (
    <div className="grid min-h-[460px] place-items-center max-md:min-h-[360px]">
      <div className="relative aspect-[1/1.08] w-[min(100%,440px)] overflow-hidden rounded-lg border border-[#2d241f] bg-[#211917] shadow-[0_24px_80px_rgba(25,16,12,0.34)]">
        <span className="absolute left-5 top-5 z-10 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-xs font-extrabold text-white backdrop-blur">
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
            impactPoint={impactPoint}
            isBroken={isBroken}
            selectedWax={selectedWax}
          />
        </button>
        <span className="absolute bottom-5 right-5 z-10 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-xs font-extrabold text-[#b8ff4d] backdrop-blur">
          {isBroken ? "완전 파괴 · 콰작 다시 듣기" : `${crackPercent}% 균열 · 3D 공 직접 클릭`}
        </span>
      </div>
    </div>
  );
}

function ThreeWaxBall({
  crackPoints,
  freezerMinutes,
  impactPoint,
  isBroken,
  selectedWax,
}: {
  crackPoints: CrackPoint[];
  freezerMinutes: number;
  impactPoint: ImpactPoint | null;
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
    scene.fog = new THREE.Fog(0x211917, 6, 16);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 0.15, 7.8);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    const revealAmount = Math.min(1, crackPoints.length / 6);
    const shellMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 1,
      clearcoatRoughness: 0.18,
      color: palette.shell,
      metalness: 0.02,
      opacity: palette.shellOpacity,
      roughness: palette.style === "apple" || palette.style === "cotton" ? 0.18 : 0.28,
      sheen: 0.35,
      transparent: palette.shellOpacity < 1,
      transmission: palette.style === "apple" ? 0.12 : palette.style === "cotton" ? 0.18 : 0,
    });

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(1.48, 72, 48),
      shellMaterial,
    );
    ball.castShadow = true;
    ball.receiveShadow = true;
    root.add(ball);

    const clearOuterShell = new THREE.Mesh(
      new THREE.SphereGeometry(1.58, 96, 64),
      new THREE.MeshPhysicalMaterial({
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        color: 0xffffff,
        opacity: 0.22,
        roughness: 0.05,
        transparent: true,
        transmission: 0.65,
      }),
    );
    clearOuterShell.castShadow = true;
    root.add(clearOuterShell);

    const shellHighlight = new THREE.Mesh(
      new THREE.TorusGeometry(1.08, 0.018, 10, 96),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        opacity: 0.36,
        transparent: true,
      }),
    );
    shellHighlight.position.set(-0.1, 0.38, 0.95);
    shellHighlight.rotation.set(1.18, -0.34, -0.22);
    root.add(shellHighlight);

    const innerClay = new THREE.Mesh(
      new THREE.SphereGeometry(1.02, 48, 32),
      new THREE.MeshPhysicalMaterial({
        clearcoat: 0.25,
        color: palette.clay,
        roughness: 0.58,
      }),
    );
    innerClay.visible = isBroken;
    innerClay.castShadow = true;
    root.add(innerClay);

    const patchGeometry = new THREE.CircleGeometry(0.24, 28);
    const patchNormals =
      palette.style === "cotton"
        ? [
            new THREE.Vector3(-0.58, 0.42, 0.7),
            new THREE.Vector3(0.45, 0.42, 0.78),
            new THREE.Vector3(-0.02, -0.54, 0.84),
            new THREE.Vector3(0.24, -0.02, 0.97),
            new THREE.Vector3(-0.44, -0.08, 0.9),
            new THREE.Vector3(0.7, -0.24, 0.68),
          ]
        : palette.style === "apple"
        ? [
            new THREE.Vector3(-0.36, 0.5, 0.79),
            new THREE.Vector3(0.52, 0.38, 0.77),
            new THREE.Vector3(-0.48, -0.24, 0.84),
            new THREE.Vector3(0.34, -0.5, 0.8),
          ]
        : [
      new THREE.Vector3(-0.62, 0.54, 0.58),
      new THREE.Vector3(-0.18, 0.7, 0.68),
      new THREE.Vector3(0.38, 0.55, 0.74),
      new THREE.Vector3(0.72, 0.14, 0.67),
      new THREE.Vector3(-0.72, -0.02, 0.68),
      new THREE.Vector3(-0.32, -0.34, 0.88),
      new THREE.Vector3(0.28, -0.42, 0.86),
      new THREE.Vector3(0.68, -0.36, 0.64),
      new THREE.Vector3(-0.04, 0.18, 0.98),
      new THREE.Vector3(0.18, -0.02, 0.98),
      new THREE.Vector3(-0.5, -0.56, 0.66),
      new THREE.Vector3(0.48, 0.0, 0.88),
          ];

    patchNormals.forEach((normal, index) => {
      const unit = normal.normalize();
      const patchOpacity =
        palette.style === "apple"
          ? 0.18
          : palette.style === "cotton"
            ? 0.92 + revealAmount * 0.06
            : revealAmount;
      const patchMaterial = new THREE.MeshPhysicalMaterial({
        clearcoat: 0.95,
        clearcoatRoughness: 0.1,
        color: palette.patchColors[index % palette.patchColors.length],
        opacity: patchOpacity,
        roughness: palette.style === "dubai" ? 0.2 : 0.16,
        transparent: true,
        transmission: palette.style === "apple" ? 0.35 : palette.style === "cotton" ? 0.22 : 0,
      });
      const patch = new THREE.Mesh(patchGeometry, patchMaterial);
      patch.position.copy(unit.clone().multiplyScalar(1.505));
      patch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), unit);
      patch.rotation.z = index * 0.8;
      if (palette.style === "dubai") {
        patch.scale.set(
          (1.42 + (index % 3) * 0.38) * (0.55 + revealAmount * 0.45),
          (0.7 + (index % 4) * 0.16) * (0.55 + revealAmount * 0.45),
          1,
        );
      } else if (palette.style === "cotton") {
        patch.scale.set(
          2.45 + (index % 3) * 0.3,
          1.55 + (index % 2) * 0.2,
          1,
        );
      } else {
        patch.scale.set(1.55 + (index % 3) * 0.22, 1.05 + (index % 2) * 0.16, 1);
      }
      patch.castShadow = true;
      root.add(patch);
    });

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
      new THREE.CylinderGeometry(0.15, 0.25, 0.58, 12),
      neckMaterial,
    );
    stem.position.set(0.1, 1.55, 0.16);
    stem.rotation.set(0.22, -0.18, 0.1);
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

    const crackGroup = new THREE.Group();
    root.add(crackGroup);
    const crackMaterial = new THREE.LineBasicMaterial({
      color: palette.crack,
      transparent: true,
      opacity: 0.95,
    });
    if (palette.style === "dubai" && revealAmount > 0) {
      const seamMaterial = new THREE.LineBasicMaterial({
        color: palette.crack,
        transparent: true,
        opacity: 0.52 + revealAmount * 0.43,
      });
      const panelSeams = [
        [
          new THREE.Vector3(-1.04, 0.58, 1.02),
          new THREE.Vector3(-0.62, 0.78, 1.28),
          new THREE.Vector3(-0.18, 0.62, 1.48),
          new THREE.Vector3(0.16, 0.86, 1.24),
        ],
        [
          new THREE.Vector3(0.18, 0.82, 1.2),
          new THREE.Vector3(0.44, 0.5, 1.46),
          new THREE.Vector3(0.76, 0.16, 1.3),
          new THREE.Vector3(1.06, -0.02, 0.98),
        ],
        [
          new THREE.Vector3(-1.06, 0.0, 1.04),
          new THREE.Vector3(-0.64, 0.14, 1.36),
          new THREE.Vector3(-0.16, -0.06, 1.5),
          new THREE.Vector3(0.36, 0.08, 1.36),
          new THREE.Vector3(0.9, -0.18, 1.02),
        ],
        [
          new THREE.Vector3(-0.86, -0.48, 0.98),
          new THREE.Vector3(-0.48, -0.24, 1.36),
          new THREE.Vector3(-0.12, -0.42, 1.46),
          new THREE.Vector3(0.26, -0.28, 1.38),
          new THREE.Vector3(0.7, -0.54, 1.02),
        ],
        [
          new THREE.Vector3(-0.42, 0.86, 1.08),
          new THREE.Vector3(-0.24, 0.28, 1.5),
          new THREE.Vector3(-0.2, -0.12, 1.54),
          new THREE.Vector3(-0.32, -0.78, 1.02),
        ],
        [
          new THREE.Vector3(0.54, 0.64, 1.04),
          new THREE.Vector3(0.18, 0.2, 1.5),
          new THREE.Vector3(0.3, -0.2, 1.48),
          new THREE.Vector3(0.5, -0.78, 1.0),
        ],
      ];
      panelSeams.slice(0, Math.min(panelSeams.length, 2 + crackPoints.length)).forEach((points) => {
        const curve = new THREE.CatmullRomCurve3(points);
        crackGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(18)), seamMaterial));
      });
    }
    if (palette.style === "cotton" && revealAmount > 0) {
      const seamMaterial = new THREE.LineBasicMaterial({
        color: palette.crack,
        transparent: true,
        opacity: 0.38 + revealAmount * 0.5,
      });
      const panelSeams = [
        [
          new THREE.Vector3(-0.95, 0.42, 1.18),
          new THREE.Vector3(-0.42, 0.68, 1.36),
          new THREE.Vector3(0.06, 0.56, 1.46),
          new THREE.Vector3(0.62, 0.74, 1.22),
        ],
        [
          new THREE.Vector3(-1.08, -0.04, 1.1),
          new THREE.Vector3(-0.48, 0.12, 1.42),
          new THREE.Vector3(0.24, 0.06, 1.5),
          new THREE.Vector3(0.98, 0.2, 1.12),
        ],
        [
          new THREE.Vector3(-0.76, -0.58, 1.0),
          new THREE.Vector3(-0.16, -0.34, 1.46),
          new THREE.Vector3(0.42, -0.44, 1.36),
          new THREE.Vector3(0.86, -0.62, 0.98),
        ],
        [
          new THREE.Vector3(-0.18, 0.94, 0.98),
          new THREE.Vector3(-0.02, 0.34, 1.52),
          new THREE.Vector3(0.04, -0.2, 1.5),
          new THREE.Vector3(0.16, -0.92, 0.98),
        ],
        [
          new THREE.Vector3(-0.86, 0.18, 1.2),
          new THREE.Vector3(-0.5, -0.24, 1.38),
          new THREE.Vector3(-0.3, -0.72, 1.08),
        ],
        [
          new THREE.Vector3(0.82, 0.42, 1.08),
          new THREE.Vector3(0.5, -0.06, 1.38),
          new THREE.Vector3(0.44, -0.7, 1.0),
        ],
      ];
      panelSeams.slice(0, Math.min(panelSeams.length, 2 + crackPoints.length)).forEach((points) => {
        const curve = new THREE.CatmullRomCurve3(points);
        crackGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(16)), seamMaterial));
      });
    }
    crackPoints.forEach((point, pointIndex) => {
      const baseX = (point.x - 50) / 35;
      const baseY = -(point.y - 50) / 35;
      const center = new THREE.Vector3(
        THREE.MathUtils.clamp(baseX, -0.9, 0.9),
        THREE.MathUtils.clamp(baseY, -0.85, 0.85),
        1.18,
      );
      const branches = 4 + Math.min(3, pointIndex);

      for (let branch = 0; branch < branches; branch += 1) {
        const angle = (branch / branches) * Math.PI * 2 + point.rotation * 0.02;
        const length = 0.35 + point.force * 0.18 + branch * 0.04;
        const mid = center.clone().add(
          new THREE.Vector3(Math.cos(angle) * length * 0.5, Math.sin(angle) * length * 0.5, 0.08),
        );
        const end = center.clone().add(
          new THREE.Vector3(Math.cos(angle) * length, Math.sin(angle) * length, 0.02),
        );
        if (palette.style === "apple") {
          const hairline = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([center, mid, end]),
            crackMaterial,
          );
          crackGroup.add(hairline);
        }
      }
    });

    const fragmentGroup = new THREE.Group();
    scene.add(fragmentGroup);
    if (isBroken) {
      const fragmentGeometry =
        palette.style === "dubai" || palette.style === "cotton"
          ? new THREE.BoxGeometry(0.34, 0.045, 0.24)
          : new THREE.TetrahedronGeometry(0.18, 0);
      for (let index = 0; index < 34; index += 1) {
        const fragmentMaterial = new THREE.MeshStandardMaterial({
          color: index % 3 === 0 ? palette.clay : palette.shell,
          roughness: palette.style === "apple" ? 0.22 : 0.52,
          transparent: palette.style === "apple" && index % 3 !== 0,
          opacity: palette.style === "apple" && index % 3 !== 0 ? 0.52 : 1,
        });
        const fragment = new THREE.Mesh(fragmentGeometry, fragmentMaterial);
        const angle = index * 2.399963229728653;
        const radius = 1.0 + (index % 6) * 0.14;
        fragment.position.set(
          Math.cos(angle) * radius,
          Math.sin(angle * 1.2) * radius * 0.72,
          1.3 + (index % 5) * 0.08,
        );
        fragment.rotation.set(index * 0.4, index * 0.7, index * 0.2);
        fragment.scale.setScalar(0.55 + (index % 4) * 0.16);
        fragment.castShadow = true;
        fragmentGroup.add(fragment);
      }
      ball.scale.setScalar(0.78);
      stem.position.y = 1.28;
      crackMaterial.opacity = 1;
    }

    const impactMark = impactPoint
      ? createImpactRing((impactPoint.x - 50) / 35, -(impactPoint.y - 50) / 35)
      : null;
    if (impactMark) {
      root.add(impactMark);
    }

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.55, 72),
      new THREE.MeshBasicMaterial({
        color: 0x080605,
        transparent: true,
        opacity: 0.36,
      }),
    );
    floor.position.set(0, -1.86, -0.2);
    floor.rotation.x = -Math.PI / 2;
    floor.scale.set(1.35, 0.38, 1);
    scene.add(floor);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(3.6, 4.2, 5.8);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xc8f7ff, 2.2);
    rimLight.position.set(-3.8, 1.8, 3.2);
    scene.add(rimLight);

    const warmLight = new THREE.PointLight(0xff9b54, 5.6, 9);
    warmLight.position.set(-2.8, -2.1, 3.4);
    scene.add(warmLight);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a1c14, 1.2));

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
      ball.scale.lerp(
        new THREE.Vector3(
          isBroken ? 0.78 : 1,
          isBroken ? 0.78 : 1,
          isBroken ? 0.78 : 1,
        ),
        0.08,
      );
      fragmentGroup.children.forEach((child, index) => {
        child.rotation.x += 0.018 + index * 0.0007;
        child.rotation.y += 0.014 + index * 0.0005;
        if (isBroken) {
          child.position.x += Math.cos(index) * 0.004;
          child.position.y += Math.sin(index * 1.3) * 0.004;
        }
      });
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
  }, [crackPoints, freezerMinutes, impactPoint, isBroken, selectedWax.name]);

  return <div ref={mountRef} className="h-full w-full" />;
}

function getThreePalette(name: string) {
  if (name.includes("두바이")) {
    return {
      clay: 0x7fb15b,
      crack: 0x93c870,
      patch: 0x5b3424,
      patchColors: [0x4a2618, 0x62341f, 0x7a4328, 0x2f1a12],
      shell: 0x3a2116,
      shellOpacity: 1,
      style: "dubai",
    } satisfies ThreePalette;
  }

  if (name.includes("솜사탕")) {
    return {
      clay: 0xf8dce8,
      crack: 0xfff3fb,
      patch: 0xf08aa9,
      patchColors: [0xff9fc8, 0x8fd8ff, 0xffec86, 0xffb6d5, 0xa5e0ff, 0xfff0a8],
      shell: 0xfff8fb,
      shellOpacity: 0.58,
      style: "cotton",
    } satisfies ThreePalette;
  }

  return {
    clay: 0xa9de49,
    crack: 0xedffd8,
    patch: 0x8ce000,
    patchColors: [0x8fd10a, 0x9ee32d, 0x6fb800],
    shell: 0x8fd10a,
    shellOpacity: 0.9,
    style: "apple",
  } satisfies ThreePalette;
}

function createImpactRing(x: number, y: number) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.32, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      opacity: 0.65,
      transparent: true,
      side: THREE.DoubleSide,
    }),
  );
  ring.position.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1), 1.55);
  ring.lookAt(0, 0, 4);
  return ring;
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
