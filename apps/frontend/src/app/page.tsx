import Link from "next/link";

const versionLinks = [
  { href: "/", label: "kkm.ver" },
  { href: "/hsj-ver", label: "hsj.ver" },
  { href: "/njjey-ver", label: "njjey.ver" },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fbfaf6] text-[#191611]">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-[#e6ded2] bg-[#fbfaf6]/86 backdrop-blur-md">
        <nav
          aria-label="버전 메뉴"
          className="mx-auto flex min-h-16 w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4 max-sm:flex-col max-sm:items-start max-sm:justify-center max-sm:py-4"
        >
          <Link className="text-[15px] font-extrabold" href="/">
            Online Wax-Cracking Ball
          </Link>
          <div className="flex flex-wrap gap-5 text-sm font-extrabold text-[#6f685e]">
            {versionLinks.map((link) => (
              <Link
                className={link.href === "/" ? "text-[#191611]" : "hover:text-[#191611]"}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <section className="mx-auto grid min-h-[100svh] w-[min(1180px,calc(100%-32px))] grid-cols-[minmax(0,0.88fr)_minmax(320px,1fr)] items-center gap-12 pt-20 max-md:grid-cols-1 max-md:pb-14 max-md:pt-28">
        <div className="max-w-[560px]">
          <p className="mb-4 text-sm font-extrabold uppercase text-[#3f88c5]">
            default version
          </p>
          <h1 className="text-6xl font-extrabold leading-none sm:text-7xl lg:text-8xl">
            kkm.ver
          </h1>
          <p className="mt-6 max-w-xl text-lg font-bold leading-8 text-[#6f685e]">
            투명 캡슐 안에 민트 젤리와 초코 왁스 조각이 들어간 기본 왁뿌볼입니다.
            눌렀을 때 금이 번지고 조각이 갈라지는 감각을 가장 단순하게 보여줍니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#191611] px-5 text-sm font-extrabold text-white"
              href="/hsj-ver"
            >
              hsj.ver 보기
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#e6ded2] bg-white/72 px-5 text-sm font-extrabold text-[#191611]"
              href="/njjey-ver"
            >
              njjey.ver 보기
            </Link>
          </div>
        </div>

        <div className="relative grid min-h-[560px] place-items-center max-md:min-h-[430px]">
          <div className="absolute inset-x-4 bottom-10 h-20 rounded-full bg-[#8db6c7]/18 blur-2xl" />
          <div className="relative aspect-square w-[min(82vw,520px)]">
            <div className="absolute inset-[5%] rounded-full bg-[#dff4ff]/42 shadow-[inset_24px_32px_50px_rgba(255,255,255,0.8),inset_-42px_-52px_70px_rgba(16,19,23,0.22),0_34px_80px_rgba(44,79,88,0.22)]" />
            <div className="absolute inset-[14%] rounded-full bg-[radial-gradient(circle_at_35%_28%,#faffee_0_8%,#bff4ca_22%,#8fe4bf_56%,#5b8f7d_100%)] shadow-[inset_-24px_-30px_44px_rgba(20,38,29,0.26)]" />
            <div className="absolute inset-[11%] rounded-full border-[3px] border-white/55" />
            <div className="absolute left-[18%] top-[18%] h-[18%] w-[28%] rounded-full bg-white/62 blur-lg" />
            <div className="absolute right-[21%] top-[25%] h-[14%] w-[18%] rounded-full bg-[#fff8d8]/72 blur-md" />

            {[
              "left-[20%] top-[25%] h-[19%] w-[18%] rotate-[22deg]",
              "left-[40%] top-[19%] h-[22%] w-[28%] -rotate-[11deg]",
              "right-[17%] top-[36%] h-[21%] w-[17%] rotate-[31deg]",
              "left-[22%] bottom-[24%] h-[20%] w-[22%] -rotate-[28deg]",
              "right-[31%] bottom-[20%] h-[17%] w-[17%] rotate-[18deg]",
              "left-[45%] top-[46%] h-[13%] w-[15%] rotate-[44deg]",
            ].map((className) => (
              <span
                aria-hidden="true"
                className={`absolute rounded-[4px] bg-[#4b261d] shadow-[inset_8px_8px_12px_rgba(255,255,255,0.08)] ${className}`}
                key={className}
              />
            ))}

            {[
              "left-[31%] top-[34%] h-[36%] rotate-[24deg]",
              "left-[54%] top-[27%] h-[45%] -rotate-[15deg]",
              "left-[43%] top-[50%] h-[28%] rotate-[78deg]",
              "left-[62%] top-[45%] h-[24%] -rotate-[62deg]",
            ].map((className) => (
              <span
                aria-hidden="true"
                className={`absolute w-[4px] origin-top rounded-full bg-[#a6f3c3] shadow-[0_0_12px_rgba(166,243,195,0.8)] ${className}`}
                key={className}
              />
            ))}

            <div className="absolute left-[8%] top-[9%] h-[8%] w-[17%] -rotate-[18deg] rounded-full bg-white/56" />
            <div className="absolute right-[6%] top-[42%] h-[7%] w-[14%] rotate-[36deg] rounded-full bg-white/48" />
            <div className="absolute left-[44%] -top-[1%] h-[12%] w-[16%] rotate-[24deg] rounded-md bg-white/42" />
          </div>
        </div>
      </section>
    </main>
  );
}
