import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getChapters, getDocMetas } from "@/lib/content";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { HeroChart } from "@/components/hero-chart";
import { GlobalReadStat } from "@/components/global-read-stat";
import { StreakBadge } from "@/components/streak-badge";
import { MarketTicker } from "@/components/market-ticker";
import { DailyTip } from "@/components/daily-tip";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict(locale).home;
  return { description: t.metaDesc };
}

export default async function Home({
  params,
}: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const p = (path: string) => `/${locale}${path}`;

  const chapters = getChapters(locale);
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
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28 grid lg:grid-cols-[1.1fr_1fr] gap-14 items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-dim)] px-4 py-1.5 text-xs font-medium text-accent shadow-[0_0_12px_rgba(52,211,153,0.15)]">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              {t.home.badge}
            </p>
            <h1 className="mt-7 text-3xl min-[420px]:text-4xl sm:text-5xl xl:text-6xl font-bold tracking-tight leading-[1.15]">
              {t.home.title1}
              <br />
              {t.home.title2Pre}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-accent to-[var(--info)]">
                {t.home.title2Accent}
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-base sm:text-lg leading-relaxed text-muted">
              {t.home.subtitle(chapters.length, totalDocs)}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href={p("/knowledge/getting-started")}
                className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-8 py-3.5 transition shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
              >
                {t.home.ctaStart}
              </Link>
              <Link
                href={p("/path")}
                className="rounded-full border border-border-strong hover:border-[var(--accent)]/60 px-8 py-3.5 font-medium transition"
              >
                {t.home.ctaPath}
              </Link>
            </div>
            <DailyTip locale={locale} />
            <GlobalReadStat
              totalDocs={totalDocs}
              textTpl={t.home.readTpl}
              keepGoing={t.home.readKeepGoing}
              syncedLabel={t.home.syncedLabel}
            />
            <div className="mt-3">
              <StreakBadge labels={{ current: "current", longest: t.home.streakLongest, days: t.home.streakDays }} />
            </div>
          </div>
          <div>
            <HeroChart locale={locale} />
            <div className="mt-4">
              <MarketTicker />
            </div>
          </div>
        </div>

        {/* 数据条 */}
        <div className="relative border-t border-[var(--border)]">
          <dl className="mx-auto max-w-6xl px-5 grid grid-cols-2 sm:grid-cols-4 gap-px">
            {t.home.stats.map(([v, k]) => (
              <div key={k} className="py-6 px-4 text-center bg-[var(--surface)]/40 hover:bg-[var(--accent-dim)] transition-colors">
                <dt className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-accent to-[var(--info)]">{v}</dt>
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
            {t.home.principlesLabel}
          </p>
          <h2 className="text-3xl font-bold mt-3">{t.home.principlesTitle}</h2>
        </header>
        <div className="grid gap-4 sm:grid-cols-3 mt-10">
          {t.home.principles.map((f, idx) => (
            <div
              key={f.t}
              className="group relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 overflow-hidden hover:border-[var(--accent)]/50 hover:bg-[var(--surface-hover)] hover:-translate-y-1 transition-all duration-200"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent to-[var(--info)] opacity-0 group-hover:opacity-100 transition-opacity" />
              <span
                className={`inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl group-hover:scale-110 transition-transform ${
                  idx === 0
                    ? "bg-[var(--accent-dim)]"
                    : idx === 1
                      ? "bg-[var(--info-dim)]"
                      : "bg-[var(--warn-dim)]"
                }`}
                aria-hidden
              >
                {f.icon}
              </span>
              <h3 className="mt-4 font-semibold text-lg">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- 精选篇章 ---------- */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <header className="max-w-xl mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {t.home.principlesLabel}
          </p>
          <h2 className="text-3xl font-bold mt-3">{t.home.ctaPath}</h2>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chapters.slice(0, 6).map((c) => (
            <Link
              key={c.slug}
              href={p(`/knowledge/${c.slug}`)}
              className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 hover:border-[var(--accent)]/50 hover:bg-[var(--surface-hover)] hover:-translate-y-1 transition-all duration-200"
            >
              <p className="font-mono text-xs text-faint">
                {String(c.order + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 font-semibold group-hover:text-accent transition-colors">
                {c.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted line-clamp-2">{c.tagline}</p>
              <p className="mt-3 text-xs text-faint">
                📚 {c.docCount} {locale === "en" ? "lessons" : "篇"}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- 精选课程（具体篇目） ---------- */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="text-2xl font-bold mb-6">
          {locale === "en" ? "Start here" : "从这几篇开始"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {chapters.slice(0, 3).map((c) => {
            const doc = getDocMetas(locale, c.slug)[0];
            if (!doc) return null;
            return (
              <Link
                key={`${c.slug}-${doc.slug}`}
                href={p(`/knowledge/${c.slug}/${doc.slug}`)}
                className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent)]/50 hover:bg-[var(--surface-hover)] transition"
              >
                <p className="text-xs text-faint font-mono">{c.title}</p>
                <p className="mt-1.5 font-medium text-sm group-hover:text-accent transition-colors">{doc.title}</p>
                <p className="mt-2 text-xs text-muted line-clamp-2">{doc.description}</p>
              </Link>
            );
          })}
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
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.02]"
            style={{
              backgroundImage:
                "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
            aria-hidden
          />
          <h2 className="relative text-2xl sm:text-3xl font-bold">
            {t.home.ctaTitle1}
            <br className="sm:hidden" />
            {t.home.ctaTitle2}
          </h2>
          <p className="relative mt-4 text-muted max-w-md mx-auto">{t.home.ctaBody}</p>
          <Link
            href={p("/knowledge/getting-started")}
            className="relative inline-block mt-8 rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-10 py-3.5 transition shadow-lg shadow-emerald-500/25"
          >
            {t.home.ctaButton} <span aria-hidden>→</span>
          </Link>
          <Link
            href={p("/ai")}
            className="relative sm:ml-3 inline-block mt-2 sm:mt-8 rounded-full border border-[var(--accent)]/40 bg-[var(--accent-dim)] hover:border-accent/60 text-accent font-medium px-8 py-3.5 transition"
          >
            <span aria-hidden>🤖 </span>{t.ai.nav} · {t.ai.title}
          </Link>
        </div>
      </section>
    </div>
  );
}
