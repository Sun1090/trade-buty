import Link from "next/link";
import { getChapters } from "@/lib/content";

// 根级 404：无 locale 上下文，默认中文（与 proxy.ts 的 fallback 一致）
// 推荐前 3 个入门篇章，引导用户回到正轨
export default function NotFound() {
  const chapters = getChapters("zh").slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl px-5 py-20 text-center">
      <p className="font-mono text-6xl font-bold text-accent">404</p>
      <h1 className="mt-6 text-2xl font-bold">
        这一页不存在
        <span className="block mt-2 text-sm font-normal text-muted">
          Page not found — 市场永远都在，页面不一定。
        </span>
      </h1>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/zh"
          className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-7 py-3 transition"
        >
          回首页 →
        </Link>
        <Link
          href="/zh/path"
          className="rounded-full border border-border-strong px-7 py-3 font-medium hover:border-accent/60 transition"
        >
          学习路线
        </Link>
      </div>

      {chapters.length > 0 && (
        <div className="mt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-faint mb-6">
            热门入门 · Popular starters
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {chapters.map((c) => (
              <Link
                key={c.slug}
                href={`/zh/knowledge/${c.slug}`}
                className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-left hover:border-[var(--accent)]/50 transition"
              >
                <p className="font-semibold text-sm group-hover:text-accent transition-colors">
                  {c.title}
                </p>
                <p className="mt-1 text-xs text-faint line-clamp-2">
                  {c.tagline}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
