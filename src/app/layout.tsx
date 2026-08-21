import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const themeInitScript = `(function(){try{var t=localStorage.getItem("tb-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

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
    "面向全球中文用户的免费中立交易教育平台：分级课程（学）× 真实行情图表与回放（练）。不荐股、不导流、不承诺收益。",
};

function CandleMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="7" width="4" height="10" rx="1" fill="#34d399" />
      <rect x="5.5" y="4" width="1" height="16" fill="#34d399" />
      <rect x="14" y="9" width="4" height="8" rx="1" fill="#f87171" />
      <rect x="15.5" y="6" width="1" height="14" fill="#f87171" />
    </svg>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
              <CandleMark />
              <span className="text-lg">Trade Buty</span>
              <span className="hidden sm:inline ml-1 px-2 py-0.5 rounded-full border border-[var(--accent)]/40 text-[11px] font-medium text-[var(--accent)]">
                免费 · 中立
              </span>
            </Link>
            <nav className="text-sm flex items-center gap-1">
              <Link
                href="/path"
                className="px-3 py-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition"
              >
                学习路线
              </Link>
              <Link
                href="/search"
                className="px-3 py-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition"
              >
                搜索
              </Link>
              <ThemeToggle />
              <a
                href="https://github.com/Sun1090/trade-buty"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition"
              >
                GitHub
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[var(--border)] mt-24">
          <div className="mx-auto max-w-6xl px-5 py-10 grid gap-8 sm:grid-cols-[1fr_auto]">
            <div className="space-y-3 max-w-md">
              <div className="flex items-center gap-2 font-bold">
                <CandleMark />
                Trade Buty
              </div>
              <p className="text-sm leading-relaxed text-muted">
                面向全球中文用户的免费中立交易教育平台。分级课程（学）× 真实行情图表与回放（练）。
              </p>
              <p className="text-xs leading-relaxed text-faint">
                ⚠️ 风险提示：本站全部内容仅用于学习与研究，不构成任何投资建议。市场有风险，投资需谨慎。
              </p>
            </div>
            <div className="text-sm space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-faint mb-3">
                导航
              </p>
              <Link href="/path" className="block text-muted hover:text-accent transition">
                学习路线
              </Link>
              <Link href="/search" className="block text-muted hover:text-accent transition">
                搜索课程
              </Link>
              <a
                href="https://github.com/sun1090/kline-buty"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-muted hover:text-accent transition"
              >
                内容来源 kline-buty
              </a>
            </div>
          </div>
          <div className="border-t border-[var(--border)]">
            <div className="mx-auto max-w-6xl px-5 py-4 text-xs text-faint flex flex-wrap justify-between gap-2">
              <span>© 2026 sun1090 · MIT License</span>
              <span>内容源自开源项目 kline-buty</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
