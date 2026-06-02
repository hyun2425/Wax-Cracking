import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "온라인 왁스볼",
  description: "온라인 왁스볼 크래킹 ASMR 시뮬레이션",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
