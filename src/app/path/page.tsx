import Link from "next/link";
import { getStageGroups } from "@/lib/path";

export const metadata = {
  title: "学习路线",
  description: "27 个篇章的三站式学习路径：入门主线 → 实战进阶 → 深水区专题。",
};

export default function PathPage() {
  const [core, practice, deep] = getStageGroups();

  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      <header className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Learning Path
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold mt-3">学习路线</h1>
        <p className="mt-4 text-muted leading-relaxed">
          三站式路径：先走完「入门主线」建立完整认知，再按方向选学进阶与深潜专题。
          建议顺序学习，不要跳读——第 08 篇会教你为什么。
        </p>
      </header>

      {/* 入门主线 */}
      <section className="mt-16">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {core.stage.label}
          </p>
          <h2 className="text-2xl font-bold mt-2">{core.stage.title}</h2>
          <p className="mt-2 text-sm text-muted">{core.stage.description}</p>
        </header>
        <ol className="relative mt-8 space-y-1 ml-2 border-l-2 border-dashed border-[var(--accent)]/25 pl-0">
          {core.chapters.map((c, i) => (
            <li key={c.num} className="relative pl-9">
              <span
                className={`absolute -left-[15px] top-6 flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-bold ${
                  i === 0
                    ? "bg-accent text-[#06281c]"
                    : "bg-[var(--surface)] border border-[var(--accent)]/40 text-accent"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <Link
                href={`/knowledge/${c.num}`}
                className="group flex items-baseline justify-between gap-6 rounded-xl px-5 py-4 hover:bg-[var(--surface-hover)] transition"
              >
                <span className="min-w-0">
                  <span className="font-semibold group-hover:text-accent transition-colors">
                    {c.title}
                  </span>
                  <span className="block mt-1 text-sm text-faint truncate">
                    {c.tagline}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs text-faint">
                  {String(c.docCount).padStart(2, "0")} 篇 →
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* 进阶 / 深潜 */}
      {[practice, deep].map((g) => (
        <section key={g.stage.id} className="mt-20">
          <header>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              {g.stage.label}
            </p>
            <h2 className="text-2xl font-bold mt-2">{g.stage.title}</h2>
            <p className="mt-2 text-sm text-muted">{g.stage.description}</p>
          </header>
          <div className="grid gap-2.5 sm:grid-cols-2 mt-8">
            {g.chapters.map((c) => (
              <Link
                key={c.num}
                href={`/knowledge/${c.num}`}
                className="group flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 hover:border-[var(--accent)]/50 hover:bg-[var(--surface-hover)] transition"
              >
                <span className="flex items-baseline gap-3 min-w-0">
                  <span className="font-mono text-xs text-accent/70">{c.num}</span>
                  <span className="truncate font-medium group-hover:text-accent transition-colors">
                    {c.title}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs text-faint">
                  {c.docCount} 篇
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <div className="mt-16 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-dim)] px-6 py-5 flex flex-wrap items-center justify-between gap-4">
        <p className="font-medium">准备好了？从第一课开始。</p>
        <Link
          href="/knowledge/01"
          className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2.5 transition"
        >
          第 01 课 →
        </Link>
      </div>
    </div>
  );
}
