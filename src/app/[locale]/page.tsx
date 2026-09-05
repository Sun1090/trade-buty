import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getChapters, getDocMetas } from "@/lib/content";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/metadata";
import { TodayPick } from "@/components/today-pick";
import { PathGlobalProgress } from "@/components/path-global-progress";
import { GlobalReadStat } from "@/components/global-read-stat";
import { StreakBadge } from "@/components/streak-badge";
import { MarketTicker } from "@/components/market-ticker";
import { DailyTip } from "@/components/daily-tip";

export function generateStaticParams() { return LOCALES.map((locale) => ({ locale })); }

export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDict(locale).home;
  return buildPageMetadata({
    locale,
    title: t.title1,
    description: t.metaDesc,
    path: `/${locale}`,
  });
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const p = (path: string) => `/${locale}${path}`;
  const chapters = getChapters(locale);
  const totalDocs = chapters.reduce((sum, chapter) => sum + chapter.docCount, 0);
  const learningChapters = chapters.map((chapter) => ({
    slug: chapter.slug,
    title: chapter.title,
    docs: getDocMetas(locale, chapter.slug).map((doc) => ({ slug: doc.slug, title: doc.title })),
  }));
  const practiceCards = [
    { icon: "📚", title: locale === "zh" ? "学课程" : "Learn", body: locale === "zh" ? "短课节、清晰路径，知道下一步学什么。" : "Short lessons with a clear next step.", href: "/path" },
    { icon: "🎯", title: locale === "zh" ? "做练习" : "Practise", body: locale === "zh" ? "在真实行情和回放中验证理解。" : "Test your understanding on real charts.", href: "/replay" },
    { icon: "🔁", title: locale === "zh" ? "复习巩固" : "Review", body: locale === "zh" ? "用错题和统计找到真正的薄弱点。" : "Turn mistakes into your next study task.", href: "/review" },
  ];

  return <div className="bg-[var(--background)]">
    <section className="border-b border-[var(--border)] bg-[radial-gradient(circle_at_80%_0%,rgba(52,211,153,.14),transparent_42%)]">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">{locale === "zh" ? "学习工作台" : "Learning workspace"}</p><h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">{locale === "zh" ? "今天，继续成为更稳的交易者。" : "Become a more deliberate trader today."}</h1><p className="mt-4 max-w-xl text-base leading-relaxed text-muted">{locale === "zh" ? "按路径学习，马上练习，再用复习巩固。每次只前进一小步。" : "Follow a path, practise immediately, and review what matters. One focused step at a time."}</p></div>
          <Link href={p("/path")} className="rounded-full border border-border-strong px-5 py-2.5 text-sm font-medium transition hover:border-accent/60 hover:text-accent">{locale === "zh" ? "查看完整路径 →" : "View learning path →"}</Link>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
          <TodayPick chapters={learningChapters} locale={locale} label={locale === "zh" ? "你的下一步" : "Your next step"} hint={locale === "zh" ? "继续课程" : "Continue course"} done={locale === "zh" ? "主线课程已完成，复习或挑战练习吧" : "Core path complete. Review or practise next."} />
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between"><p className="text-sm font-semibold">{locale === "zh" ? "总进度" : "Overall progress"}</p><span className="text-xs text-faint">{totalDocs} {locale === "zh" ? "节课" : "lessons"}</span></div><div className="mt-4"><PathGlobalProgress chapters={chapters.map((c) => ({ slug: c.slug, docCount: c.docCount }))} /></div><div className="mt-4"><StreakBadge labels={{ current: locale === "zh" ? "连续学习" : "Streak", longest: locale === "zh" ? "最长" : "Best", days: locale === "zh" ? "天" : "days" }} /></div></div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><GlobalReadStat totalDocs={totalDocs} textTpl={t.home.readTpl} keepGoing={t.home.readKeepGoing} syncedLabel={t.home.syncedLabel} /><DailyTip locale={locale} /></div>
      </div>
    </section>
    <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
      <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{locale === "zh" ? "学习路径" : "Learning path"}</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">{locale === "zh" ? "从基础到实战，按阶段推进" : "Move from foundations to practice"}</h2></div><Link href={p("/path")} className="text-sm text-accent hover:underline">{locale === "zh" ? "全部章节" : "All chapters"} →</Link></div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{chapters.slice(0, 6).map((chapter, index) => <Link key={chapter.slug} href={p(`/knowledge/${chapter.slug}`)} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:-translate-y-1 hover:border-accent/50 hover:bg-[var(--surface-hover)]"><div className="flex items-center justify-between"><span className="font-mono text-xs text-accent/80">{String(index + 1).padStart(2, "0")}</span><span className="text-xs text-faint">{chapter.docCount} {locale === "zh" ? "节课" : "lessons"}</span></div><h3 className="mt-5 font-semibold group-hover:text-accent">{chapter.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{chapter.tagline}</p><div className="mt-5 text-xs font-medium text-accent">{locale === "zh" ? "进入课程" : "Open course"} <span className="transition group-hover:translate-x-1">→</span></div></Link>)}</div>
      <section className="mt-16 grid gap-4 md:grid-cols-3">{practiceCards.map((item) => <Link key={item.href} href={p(item.href)} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 transition hover:border-accent/50"><span className="text-2xl" aria-hidden>{item.icon}</span><h3 className="mt-4 font-semibold group-hover:text-accent">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p><span className="mt-5 block text-sm text-accent">{locale === "zh" ? "开始 →" : "Start →"}</span></Link>)}</section>
      <section className="mt-16 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{locale === "zh" ? "市场练习" : "Market practice"}</p><h2 className="mt-2 text-xl font-bold">{locale === "zh" ? "把今天学到的概念放到图表上" : "Put today’s ideas on a chart"}</h2></div><Link href={p("/chart")} className="rounded-full bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent dark:text-[#06281c]">{locale === "zh" ? "打开练习场" : "Open practice"}</Link></div><div className="mt-5"><MarketTicker /></div></section>
    </div>
  </div>;
}
