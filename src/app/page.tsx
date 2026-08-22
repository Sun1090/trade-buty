import Link from "next/link";
import { getChapters } from "@/lib/content";
import { HeroChart } from "@/components/hero-chart";
import { GlobalReadStat } from "@/components/global-read-stat";

export default function Home() {
  const chapters = getChapters();
  const totalDocs = chapters.reduce((s, c) => s + c.docCount, 0);

  return (
    <div>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden border-b border-[var(--border)]">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 50% at 70% 10%, rgba(52,211,153,.08), transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28 grid lg:grid-cols-[1.1fr_1fr] gap-14 items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-dim)] px-4 py-1.5 text-xs font-medium text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              免费开源 · 不荐股 · 不导流 · 不承诺收益
            </p>
            <h1 className="mt-7 text-3xl min-[420px]:text-4xl sm:text-5xl xl:text-6xl font-bold tracking-tight leading-[1.15]">
              先学会不亏大钱，
              <br />
              再谈
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-indigo-400">
                {" "}赚钱
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-base sm:text-lg leading-relaxed text-muted">
              {chapters.length} 个篇章、{totalDocs} 篇课程的系统化中文交易教育。
              只讲知识，不卖课，不带节奏。
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/knowledge/01"
                className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-8 py-3.5 transition shadow-lg shadow-emerald-500/20"
              >
                从第 01 课开始 →
              </Link>
              <Link
                href="/path"
                className="rounded-full border border-border-strong hover:border-[var(--accent)]/60 px-8 py-3.5 font-medium transition"
              >
                查看学习路线
              </Link>
            </div>
            <GlobalReadStat totalDocs={totalDocs} />
          </div>
          <div className="hidden lg:block">
            <HeroChart />
          </div>
        </div>

        {/* 数据条 */}
        <div className="relative border-t border-[var(--border)]">
          <dl className="mx-auto max-w-6xl px-5 grid grid-cols-2 sm:grid-cols-4 divide-x divide-[var(--border)]">
            {[
              ["27", "篇章体系"],
              [String(totalDocs), "篇深度课程"],
              ["4.2万+", "行原创内容"],
              ["¥0", "永久免费"],
            ].map(([v, k]) => (
              <div key={k} className="py-6 text-center">
                <dt className="text-2xl sm:text-3xl font-bold text-accent">{v}</dt>
                <dd className="mt-1 text-xs text-faint">{k}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- 产品原则 ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <header className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Principles
          </p>
          <h2 className="text-3xl font-bold mt-3">为什么值得信任</h2>
        </header>
        <div className="grid gap-4 sm:grid-cols-3 mt-10">
          {[
            {
              t: "中立，不带货",
              d: "不推荐任何券商、基金、信号源。内容全部开源在 GitHub，每一篇都带定制化风险提示。",
              icon: "⚖️",
            },
            {
              t: "先教避坑",
              d: "第 08 篇就是「入土篇」：骗局识别、爆仓的数学、退出机制。先学怎么不死，再学怎么赢。",
              icon: "🛡️",
            },
            {
              t: "边学边练（开发中）",
              d: "概念页内嵌真实行情 K 线与历史回放练习。读完就能上手验证，而不是纸上谈兵。",
              icon: "📈",
            },
          ].map((f) => (
            <div
              key={f.t}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 hover:border-[var(--accent)]/40 transition"
            >
              <span className="text-2xl" aria-hidden>{f.icon}</span>
              <h3 className="mt-4 font-semibold text-lg">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="mx-auto max-w-6xl px-5 pb-28">
        <div className="relative overflow-hidden rounded-3xl border border-[var(--accent)]/30 px-8 py-14 sm:px-14 text-center">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(80% 100% at 50% 100%, rgba(52,211,153,.12), transparent 70%)",
            }}
            aria-hidden
          />
          <h2 className="relative text-2xl sm:text-3xl font-bold">
            市场永远都在，
            <br className="sm:hidden" />
            本金只有一次。
          </h2>
          <p className="relative mt-4 text-muted max-w-md mx-auto">
            花两周把主线走完，再决定要不要开户。
          </p>
          <Link
            href="/knowledge/01"
            className="relative inline-block mt-8 rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-10 py-3.5 transition shadow-lg shadow-emerald-500/25"
          >
            现在开始，免费 →
          </Link>
        </div>
      </section>
    </div>
  );
}
