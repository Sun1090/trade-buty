import Link from "next/link";
import { getChapters } from "@/lib/content";

export default function Home() {
  const chapters = getChapters();
  const totalDocs = chapters.reduce((s, c) => s + c.docCount, 0);

  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          从入门到入土的交易学习路线
        </h1>
        <p className="mt-4 text-base sm:text-lg opacity-70 max-w-2xl">
          {chapters.length} 个篇章 · {totalDocs} 篇课程，现货、期货、股票、加密、外汇全覆盖。
          免费中立，不荐股、不导流、不承诺收益。
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pb-8">
        {chapters.map((c) => (
          <Link
            key={c.num}
            href={`/knowledge/${c.num}`}
            className="group rounded-xl border border-black/10 dark:border-white/15 p-5 hover:border-blue-500/60 hover:shadow-md transition"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-mono opacity-50">{c.num}</span>
              <h2 className="font-semibold group-hover:text-blue-500 transition-colors">
                {c.title}
              </h2>
            </div>
            <p className="mt-2 text-sm opacity-60 line-clamp-3 min-h-14">{c.tagline}</p>
            <p className="mt-3 text-xs opacity-40">{c.docCount} 篇</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
