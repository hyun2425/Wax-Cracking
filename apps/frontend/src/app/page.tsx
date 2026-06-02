"use client";

import { useEffect, useMemo, useState } from "react";

type ApiState =
  | { status: "checking" }
  | { status: "online"; service: string; database: string }
  | { status: "offline"; message: string };

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8080";

const waxTypes = [
  {
    name: "두바이 왁스볼",
    description: "초콜릿빛 외피와 금빛 라인이 들어간 묵직한 크랙감.",
    tag: "묵직한 파열음",
    className: "from-[#2d1c15] via-[#7b4b31] to-[#d7a948]",
  },
  {
    name: "솜사탕 왁스볼",
    description: "핑크, 하늘, 보라가 섞인 부드럽고 가벼운 크랙감.",
    tag: "가벼운 바스락",
    className: "from-[#f08aa9] via-[#98d8ef] to-[#a487df]",
  },
  {
    name: "청사과 왁스볼",
    description: "연두빛 표면이 주는 시원하고 산뜻한 쪼개짐.",
    tag: "시원한 깨짐",
    className: "from-[#d9ff8f] via-[#9bd66a] to-[#4e9b70]",
  },
];

const freezerRows = [
  ["0~5분", "말랑"],
  ["5~10분", "보통"],
  ["10~15분", "단단"],
  ["15~20분", "매우 단단"],
  ["20분", "최고 경도"],
];

const sounds = ["톡", "빠각", "바삭", "쩌억", "크그작"];

export default function Home() {
  const [apiState, setApiState] = useState<ApiState>({ status: "checking" });
  const healthUrl = useMemo(() => `${apiBaseUrl}/api/health`, []);

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
            <a href="#features">왁스볼</a>
            <a href="#freezer">냉동 시스템</a>
            <a href="#sound">ASMR</a>
            <a href="#deploy">배포 상태</a>
          </div>
        </nav>

        <section className="mx-auto grid w-[min(1120px,calc(100%-32px))] grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)] items-center gap-14 py-16 max-md:grid-cols-1">
          <div>
            <p className="mb-3 text-sm font-extrabold uppercase text-[#3f88c5]">
              ASMR Simulation Service
            </p>
            <h1 className="max-w-3xl text-6xl font-extrabold leading-none text-[#191611] sm:text-7xl lg:text-8xl">
              온라인 왁스볼
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#6f685e]">
              유튜브와 숏폼에서 보는 왁스볼 깨기 콘텐츠를 웹에서 반복해서
              즐기는 ASMR 시뮬레이션 프로젝트입니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#191611] px-5 text-sm font-extrabold text-white"
                href="#features"
              >
                왁스볼 보기
              </a>
              <a
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#e6ded2] bg-white/70 px-5 text-sm font-extrabold text-[#191611]"
                href="#freezer"
              >
                냉동 시간 확인
              </a>
            </div>
          </div>

          <div className="grid min-h-[420px] place-items-center max-md:min-h-[340px]">
            <div className="relative grid aspect-[1/1.08] w-[min(100%,420px)] place-items-center rounded-lg border border-[#9ccce7] bg-white/70 p-6 shadow-[0_22px_70px_rgba(63,136,197,0.18)]">
              <span className="absolute left-5 top-5 rounded-full border border-[#e6ded2] bg-white px-3 py-2 text-xs font-extrabold">
                20분 냉동
              </span>
              <div className="relative aspect-square w-[min(72%,270px)] overflow-hidden rounded-full bg-[linear-gradient(135deg,rgba(255,255,255,0.24),transparent_35%),linear-gradient(145deg,#3a2419,#7a4b31_58%,#c79b3d)] shadow-[inset_-28px_-34px_45px_rgba(0,0,0,0.22),0_26px_34px_rgba(58,36,25,0.24)]">
                <span className="absolute left-[48%] top-[20%] h-28 w-1 rotate-[15deg] rounded-full bg-[#fff5df] shadow-[0_0_10px_rgba(255,245,223,0.7)]" />
                <span className="absolute left-[43%] top-[42%] h-20 w-1 -rotate-[46deg] rounded-full bg-[#fff5df] shadow-[0_0_10px_rgba(255,245,223,0.7)]" />
                <span className="absolute right-[34%] top-[45%] h-24 w-1 rotate-[47deg] rounded-full bg-[#fff5df] shadow-[0_0_10px_rgba(255,245,223,0.7)]" />
                <span className="absolute inset-[17%] rounded-full border-t-8 border-[#c79b3d]/80 -rotate-[24deg]" />
              </div>
              <span className="absolute bottom-5 right-5 rounded-full border border-[#e6ded2] bg-white px-3 py-2 text-xs font-extrabold text-[#3f88c5]">
                크그작!
              </span>
            </div>
          </div>
        </section>
      </header>

      <section className="mx-auto w-[min(900px,calc(100%-32px))] py-20">
        <p className="mb-3 text-sm font-extrabold uppercase text-[#3f88c5]">
          Project Goal
        </p>
        <h2 className="text-4xl font-extrabold leading-tight sm:text-5xl">
          실제 왁스볼의 만족감을 웹에서 가볍게 반복하기
        </h2>
        <p className="mt-6 text-lg leading-8 text-[#6f685e]">
          원하는 왁스볼을 고르고, 냉동실에 넣어 굳힌 뒤 직접 눌러 깨는
          경험을 목표로 합니다. 냉동 시간에 따라 강도, 균열, 파괴음이 달라지는
          것이 핵심입니다.
        </p>
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
                className={`aspect-square w-[74px] rounded-full bg-gradient-to-br ${wax.className} shadow-[inset_-12px_-14px_18px_rgba(0,0,0,0.2)]`}
              />
              <h3 className="mt-5 text-2xl font-extrabold">{wax.name}</h3>
              <p className="mt-2 text-[15px] leading-7 text-[#6f685e]">
                {wax.description}
              </p>
              <span className="mt-auto pt-6 text-sm font-extrabold text-[#3f88c5]">
                {wax.tag}
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
            게임 안에서는 1초가 1분처럼 적용됩니다. 최대 20초만 기다리면
            가장 단단한 왁스볼을 깨볼 수 있습니다.
          </p>
        </div>

        <div className="rounded-lg border border-[#e6ded2] bg-[#f7efe2] p-3">
          {freezerRows.map(([time, state], index) => (
            <div
              className={`flex min-h-14 items-center justify-between gap-4 border-b border-[#e6ded2] px-4 py-3 last:border-b-0 ${
                index === freezerRows.length - 1
                  ? "rounded-md bg-[#3f88c5] text-white"
                  : ""
              }`}
              key={time}
            >
              <strong>{time}</strong>
              <span
                className={`font-extrabold ${
                  index === freezerRows.length - 1
                    ? "text-white"
                    : "text-[#6f685e]"
                }`}
              >
                {state}
              </span>
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
            {sounds.map((sound) => (
              <span
                className="grid min-h-24 place-items-center rounded-lg border border-[#e6ded2] bg-white text-2xl font-extrabold shadow-sm"
                key={sound}
              >
                {sound}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-20">
        <SectionHeading eyebrow="Cracking Flow" title="마우스 클릭 파괴 과정" />
        <ol className="grid list-none grid-cols-5 gap-3 p-0 max-md:grid-cols-1">
          {["클릭 시작", "균열 발생", "균열 확장", "완전 파괴", "소리 재생"].map(
            (step, index) => (
              <li
                className="flex min-h-28 flex-col justify-between rounded-lg bg-[#191611] p-5 font-extrabold text-white"
                key={step}
              >
                <span className="text-3xl text-[#dff5ff]">{index + 1}</span>
                <span>{step}</span>
              </li>
            ),
          )}
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
