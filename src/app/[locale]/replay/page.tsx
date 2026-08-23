import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { ReplayTrainer } from "@/components/replay-trainer";
import { ReplayHistory } from "@/components/replay-history";
import { HeroCard } from "@/components/hero-card";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/replay">): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict(locale).replay;
  return { title: t.title, description: t.intro };
}

export default async function ReplayPage({
  params,
}: PageProps<"/[locale]/replay">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <HeroCard label={dict.replay.label} title={dict.replay.title}>
        {dict.replay.intro}
      </HeroCard>
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
    </div>
  );
}
