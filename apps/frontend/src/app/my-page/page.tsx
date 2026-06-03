import Link from "next/link";

export default function MyPage() {
  return (
    <main className="min-h-screen bg-[#fbfaf6] text-[#191611]">
      <header className="border-b border-[#e6ded2] bg-white">
        <nav
          className="mx-auto flex w-[min(1120px,calc(100%-32px))] items-center justify-between gap-5 py-6 max-md:flex-col max-md:items-start"
          aria-label="주요 메뉴"
        >
          <Link className="text-[15px] font-extrabold" href="/">
            Online Wax-Cracking Ball
          </Link>
          <div className="flex flex-wrap gap-5 text-sm font-bold text-[#6f685e]">
            <Link href="/">홈</Link>
            <Link href="/my-page">내가 만들 페이지</Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-85px)] w-[min(1120px,calc(100%-32px))] flex-col justify-center py-20">
        <p className="mb-3 text-sm font-extrabold uppercase text-[#3f88c5]">
          My Build
        </p>
        <h1 className="max-w-3xl text-5xl font-extrabold leading-tight sm:text-6xl">
          내가 만들 페이지
        </h1>
      </section>
    </main>
  );
}
