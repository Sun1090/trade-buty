import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/metadata";
import { ReplayTrainer } from "@/components/replay-trainer";
import { ReplayHistory } from "@/components/replay-history";
import { HeroCard } from "@/components/hero-card";
import { ReplayTrend } from "@/components/replay-trend";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/replay">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDict(locale).replay;
  return buildPageMetadata({
    locale,
    title: t.title,
    description: t.intro,
    path: `/${locale}/replay`,
  });
}

export default async function ReplayPage({
  params,
}: PageProps<"/[locale]/replay">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
      <HeroCard label={dict.replay.label} title={dict.replay.title}>
        {dict.replay.intro}
      </HeroCard>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          ["01", locale === "zh" ? "观察" : "Observe", locale === "zh" ? "先看走势，不急着猜。" : "Read the move before guessing."],
          ["02", locale === "zh" ? "决策" : "Decide", locale === "zh" ? "选择上涨或下跌，记录判断。" : "Choose up or down and commit."],
          ["03", locale === "zh" ? "复盘" : "Review", locale === "zh" ? "看准确率和连击，找到模式。" : "Use accuracy and streaks to improve."],
        ].map(([number, title, body]) => (
          <div key={number} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <span className="font-mono text-xs text-accent">{number}</span>
            <p className="mt-3 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </div>
      <ReplayTrainer dict={dict.replay} />
      <ReplayHistory
        dict={{
          histTitle: dict.replay.histTitle,
          histRounds: dict.replay.histRounds,
          histAccuracy: dict.replay.histAccuracy,
          histBest: dict.replay.histBest,
          histEmpty: dict.replay.histEmpty,
          histRecent: dict.replay.histRecent,
        }}
      />
      <div className="mt-8">
        <ReplayTrend
          label={dict.replay.histTitle}
          emptyLabel={dict.replay.histEmpty}
        />
      </div>
    </div>
  );
}
