import Link from "next/link";
import { notFound } from "next/navigation";
import { getStageGroups } from "@/lib/path";
import { getChapters, getDocMetas } from "@/lib/content";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { PathProgress } from "@/components/path-progress";
import { PathGlobalProgress } from "@/components/path-global-progress";
import { KnowledgeGraph } from "@/components/knowledge-graph";
import { TodayPick } from "@/components/today-pick";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/path">) {
  const { locale } = await params;
  const t = getDict(locale);
  return { title: t.path.title, description: t.path.intro, alternates: { canonical: `/${locale}/path` } };
}

export default async function PathPage({
  params,
}: PageProps<"/[locale]/path">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const p = (path: string) => `/${locale}${path}`;
  const groups = getStageGroups(locale).map((g) => ({
    ...g,
    stageText: t.path.stages[g.stage.id],
  }));
  const [core, practice, deep] = groups;
  const chapters = groups.flatMap((g) =>
    g.chapters.map((c) => ({ slug: c.slug, docCount: c.docCount }))
  );
  // 今日推荐需要：篇章 + 课程标题
  const allChapters = getChapters(locale).map((c) => ({
    slug: c.slug,
    title: c.title,
    docs: getDocMetas(locale, c.slug).map((d) => ({ slug: d.slug, title: d.title })),
  }));

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
      <header className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {t.path.label}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold mt-3">{t.path.title}</h1>
        <p className="mt-4 text-muted leading-relaxed">{t.path.intro}</p>
        {t.path.translationNote && (
          <p className="mt-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-dim)] px-4 py-3 text-sm text-accent">
            {t.path.translationNote.replace(
              "{done}",
              String(groups.reduce((s, g) => s + g.chapters.length, 0))
            )}
          </p>
        )}
      </header>

      {/* 全局进度 */}
      <div className="mt-8">
        <PathGlobalProgress chapters={chapters} />
      </div>

      {/* 今日推荐 */}
      <TodayPick
        chapters={allChapters}
        locale={locale}
        label={locale === "en" ? "Continue learning" : "继续学习"}
        hint={locale === "en" ? "Your next lesson" : "下一篇课程"}
        done={locale === "en" ? "All done!" : "全部读完！"}
      />

      {/* 入门主线 */}
      <section className="mt-14 rounded-3xl border border-[var(--border)] bg-[var(--surface)]/50 p-5 sm:p-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {core.stageText.label}
          </p>
          <h2 className="text-2xl font-bold mt-2">{core.stageText.title}</h2>
          <p className="mt-2 text-sm text-muted">{core.stageText.description}</p>
        </header>
        <ol className="relative mt-8 space-y-1 ml-2 border-l-2 border-dashed border-[var(--accent)]/25 pl-0">
          {core.chapters.map((c, i) => (
            <li key={c.slug} className="relative pl-9">
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
                href={p(`/knowledge/${c.slug}`)}
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
                <span className="shrink-0 flex items-center gap-3">
                  <PathProgress chapterSlug={c.slug} docCount={c.docCount} />
                  <span className="font-mono text-xs text-faint">
                    {String(c.docCount).padStart(2, "0")} {t.path.lessonsUnit} →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* 进阶 / 深潜 */}
      {[practice, deep].map((g) => (
        <section key={g.stage.id} className="mt-14 rounded-3xl border border-[var(--border)] bg-[var(--surface)]/30 p-5 sm:p-8">
          <header>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              {g.stageText.label}
            </p>
            <h2 className="text-2xl font-bold mt-2">{g.stageText.title}</h2>
            <p className="mt-2 text-sm text-muted">{g.stageText.description}</p>
          </header>
          <div className="grid gap-2.5 sm:grid-cols-2 mt-8">
            {g.chapters.map((c) => (
              <Link
                key={c.slug}
                href={p(`/knowledge/${c.slug}`)}
                className="group min-w-0 flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 hover:border-[var(--accent)]/50 hover:bg-[var(--surface-hover)] transition"
              >
                <span className="flex items-baseline gap-3 min-w-0">
                  <span className="font-mono text-xs text-accent/70">{String(c.order).padStart(2, "0")}</span>
                  <span className="truncate font-medium group-hover:text-accent transition-colors">
                    {c.title}
                  </span>
                </span>
                <span className="shrink-0 flex items-center gap-2">
                  <PathProgress chapterSlug={c.slug} docCount={c.docCount} />
                  <span className="font-mono text-xs text-faint">
                    {c.docCount}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <div className="mt-16 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-dim)] px-6 py-5 flex flex-wrap items-center justify-between gap-4">
        <p className="font-medium">{t.path.readyCta}</p>
        <Link
          href={p("/knowledge/getting-started")}
          className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2.5 transition"
        >
          {t.path.lesson1}
        </Link>
      </div>

      {/* 知识点图谱 */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">{t.path.label} · Map</h2>
        <p className="mt-2 text-sm text-muted">
          {locale === "en" ? "27 chapters across 3 stages" : "27 篇章 × 3 阶段"}
        </p>
        <div className="mt-6">
          <KnowledgeGraph locale={locale} />
        </div>
      </section>
    </div>
  );
}
