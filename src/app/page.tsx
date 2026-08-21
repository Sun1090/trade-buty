import Link from "next/link";
import { getChapters } from "@/lib/content";
import { getStageGroups } from "@/lib/path";

export default function Home() {
  const chapters = getChapters();
  const totalDocs = chapters.reduce((s, c) => s + c.docCount, 0);
  const groups = getStageGroups();
  const [core, practice, deep] = groups;

  return (
    <div className="mx-auto max-w-5xl px-4">
      {/* Hero */}
      <section className="py-16 sm:py-24 text-center">
        <p className="inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
          免费开源 · 不荐股 · 不导流 · 不承诺收益
        </p>
        <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          别急着开户，
          <br className="sm:hidden" />
          先学会活着回来
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base sm:text-lg opacity-70">
          {chapters.length} 个篇章、{totalDocs} 篇课程的系统化交易教育。
          从看懂第一根 K 线，到建立自己的交易系统——全程免费，只讲知识，不卖课。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/knowledge/01"
            className="rounded-full bg-blue-600 hover:bg-blue-500 text-white px-7 py-3 font-medium transition shadow-lg shadow-blue-600/20"
          >
            从第 01 篇开始 →
          </Link>
          <Link
            href="/search"
            className="rounded-full border border-black/15 dark:border-white/25 px-7 py-3 font-medium hover:border-blue-500/60 transition"
          >
            搜索课程
          </Link>
        </div>
        <dl className="mx-auto mt-12 grid max-w-md grid-cols-3 gap-4 text-center">
          {[
            ["27", "篇章"],
            [String(totalDocs), "篇课程"],
            ["¥0", "永久免费"],
          ].map(([v, k]) => (
            <div key={k}>
              <dt className="text-2xl sm:text-3xl font-bold">{v}</dt>
              <dd className="mt-1 text-xs opacity-50">{k}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 入门主线：纵向路径 */}
      <section className="pb-16">
        <header className="mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-500">
            {core.stage.label}
          </p>
          <h2 className="text-2xl font-bold mt-1">{core.stage.title}</h2>
          <p className="mt-1 text-sm opacity-60">{core.stage.description}</p>
        </header>
        <ol className="relative mt-8 space-y-2 border-l-2 border-blue-500/25 pl-0 ml-3">
          {core.chapters.map((c, i) => (
            <li key={c.num} className="relative pl-8">
              <span
                className={`absolute -left-[13px] top-5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  i === 0
                    ? "bg-blue-600 text-white"
                    : "bg-blue-600/10 text-blue-500 dark:text-blue-400"
                }`}
              >
                {i + 1}
              </span>
              <Link
                href={`/knowledge/${c.num}`}
                className="group flex items-baseline justify-between gap-4 rounded-lg px-4 py-3.5 hover:bg-blue-500/5 transition"
              >
                <span className="min-w-0">
                  <span className="font-semibold group-hover:text-blue-500 transition-colors">
                    {c.title}
                  </span>
                  <span className="block mt-0.5 text-sm opacity-55 truncate">
                    {c.tagline}
                  </span>
                </span>
                <span className="shrink-0 text-xs opacity-40">
                  {c.docCount} 篇
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* 进阶与深潜：紧凑分组 */}
      {[practice, deep].map((g) => (
        <section key={g.stage.id} className="pb-14">
          <header className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-500">
              {g.stage.label}
            </p>
            <h2 className="text-2xl font-bold mt-1">{g.stage.title}</h2>
            <p className="mt-1 text-sm opacity-60">{g.stage.description}</p>
          </header>
          <div className="grid gap-2 sm:grid-cols-2">
            {g.chapters.map((c) => (
              <Link
                key={c.num}
                href={`/knowledge/${c.num}`}
                className="group flex items-baseline justify-between gap-3 rounded-lg border border-black/10 dark:border-white/15 px-4 py-3 hover:border-blue-500/60 transition"
              >
                <span className="truncate">
                  <span className="font-mono text-xs opacity-40 mr-2">
                    {c.num}
                  </span>
                  <span className="font-medium group-hover:text-blue-500 transition-colors">
                    {c.title}
                  </span>
                </span>
                <span className="shrink-0 text-xs opacity-40">
                  {c.docCount} 篇
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/* 产品原则 */}
      <section className="pb-20 grid gap-4 sm:grid-cols-3">
        {[
          {
            t: "中立，不带货",
            d: "不推荐任何券商、基金、信号源。知识库开源，每一篇都带风险提示。",
          },
          {
            t: "边学边练（即将上线）",
            d: "学完概念直接在真实行情图表上练习，历史回放复盘你的每一次决策。",
          },
          {
            t: "先教避坑",
            d: "第 08 篇就是「入土篇」：骗局识别、爆仓数学、退出机制。先学怎么不死。",
          },
        ].map((f) => (
          <div
            key={f.t}
            className="rounded-xl border border-black/10 dark:border-white/15 p-5"
          >
            <h3 className="font-semibold">{f.t}</h3>
            <p className="mt-2 text-sm opacity-60 leading-relaxed">{f.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
