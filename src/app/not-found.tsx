import Link from "next/link";
import { getChapters } from "@/lib/content";
import { DEFAULT_LOCALE } from "@/lib/i18n";

// 根级 404：无 locale 上下文，用默认语言
export default function NotFound() {
  const chapters = getChapters(DEFAULT_LOCALE).slice(0, 6);

  return (
    <div className="relative mx-auto max-w-3xl px-5 py-20 text-center overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, rgba(52,211,153,.08), transparent 70%)",
        }}
        aria-hidden
      />
      <p className="relative font-mono text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-accent to-[var(--info)]">404</p>
      <h1 className="mt-6 text-2xl font-bold">
        Page not found
        <span className="block mt-2 text-sm font-normal text-muted">
          市场永远都在，页面不一定。
        </span>
      </h1>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href={`/${DEFAULT_LOCALE}/search`}
          className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-7 py-3 transition"
        >
          🔍 Search →
        </Link>
        <Link
          href={`/${DEFAULT_LOCALE}`}
          className="rounded-full border border-border-strong px-7 py-3 font-medium hover:border-accent/60 transition"
        >
          Home
        </Link>
        <Link
          href={`/${DEFAULT_LOCALE}/path`}
          className="rounded-full border border-border-strong px-7 py-3 font-medium hover:border-accent/60 transition"
        >
          Learning Path
        </Link>
      </div>

      {chapters.length > 0 && (
        <div className="mt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-faint mb-6">
            Popular starters
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {chapters.map((c) => (
              <Link
                key={c.slug}
                href={`/${DEFAULT_LOCALE}/knowledge/${c.slug}`}
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
