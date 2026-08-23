import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { ReplayTrainer } from "@/components/replay-trainer";
import { ReplayHistory } from "@/components/replay-history";

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
      <header className="mb-8 rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent-dim)] via-[var(--surface)] to-[var(--surface)] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {dict.replay.label}
        </p>
        <h1 className="text-3xl font-bold mt-3">{dict.replay.title}</h1>
        <p className="mt-3 text-muted leading-relaxed">{dict.replay.intro}</p>
      </header>
      <ReplayTrainer dict={dict.replay} />
      <ReplayHistory
        dict={{
          histTitle: dict.replay.histTitle,
          histRounds: dict.replay.histRounds,
          histAccuracy: dict.replay.histAccuracy,
          histEmpty: dict.replay.histEmpty,
          histRecent: dict.replay.histRecent,
        }}
      />
    </div>
  );
}
