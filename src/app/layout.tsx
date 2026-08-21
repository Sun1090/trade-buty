import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Trade Buty · 免费中立交易教育",
    template: "%s · Trade Buty",
  },
  description:
    "面向全球中文用户的免费中立交易教育平台：分级课程（学）× 真实行情图表与回放（练）。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-black/10 dark:border-white/10 bg-[var(--background)]/85 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
            <Link href="/" className="font-bold text-lg tracking-tight">
              Trade&nbsp;Buty
              <span className="ml-2 text-xs font-normal opacity-60 hidden sm:inline">
                免费中立交易教育
              </span>
            </Link>
            <nav className="text-sm flex gap-4">
              <Link href="/" className="opacity-80 hover:opacity-100">
                学习路线
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-black/10 dark:border-white/10 mt-16">
          <div className="mx-auto max-w-5xl px-4 py-6 text-xs opacity-60 space-y-1">
            <p>
              ⚠️ 风险提示：本站全部内容仅用于学习与研究，不构成任何投资建议。市场有风险，投资需谨慎。
            </p>
            <p>
              内容源自开源项目{" "}
              <a
                href="https://github.com/sun1090/kline-buty"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                kline-buty
              </a>{" "}
              · MIT License
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
