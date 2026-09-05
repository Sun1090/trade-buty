import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import {
  decodeQuiz,
  decodeReplay,
  decodeStreak,
  detectKind,
  type ShareKind,
} from "@/lib/share-decode";
import { getDict, DEFAULT_LOCALE } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";
import { ShareCardPreview } from "@/components/share-card-preview";
import { JsonLd } from "@/components/json-ld";

interface RouteParams {
  kind: string;
  path: string;
}

/** R8.4 分享落地页：纯 SSR + OG meta + JSON-LD；客户端 share-card 仅做下载。 */
export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { kind, path } = await params;
  if (!isShareKind(kind)) return { robots: { index: false, follow: false } };
  if (detectKind(path) !== kind) {
    return { robots: { index: false, follow: false } };
  }

  const { title, description, locale } = summarizeForMeta(kind, path);
  return buildPageMetadata({
    locale,
    title,
    description,
    path: `/share/${kind}/${path}`,
    type: "website",
  });
}

function isShareKind(s: string): s is ShareKind {
  return s === "quiz" || s === "replay" || s === "streak";
}

/** 用于 meta + 页面标题的纯文本摘要（不渲染卡片）。 */
function summarizeForMeta(
  kind: ShareKind,
  path: string,
): { title: string; description: string; locale: "zh" | "en" } {
  const t = getDict(DEFAULT_LOCALE);
  if (kind === "quiz") {
    const p = decodeQuiz(path);
    if (!p) return { title: t.share.invalidQuizTitle, description: t.share.invalidBody, locale: "zh" };
    const locale = p.locale;
    const lt = getDict(locale);
    return {
      title: lt.share.quizTitleTpl
        .replace("{chapter}", p.chapterTitle)
        .replace("{grade}", gradeLabel(p.percent, locale))
        .replace("{score}", `${p.score}`)
        .replace("{total}", `${p.total}`),
      description: lt.share.quizDescTpl
        .replace("{chapter}", p.chapterTitle)
        .replace("{score}", `${p.score}`)
        .replace("{total}", `${p.total}`)
        .replace("{percent}", `${Math.round(p.percent)}`),
      locale,
    };
  }
  if (kind === "replay") {
    const p = decodeReplay(path);
    if (!p) return { title: t.share.invalidReplayTitle, description: t.share.invalidBody, locale: "zh" };
    const locale = p.locale;
    const lt = getDict(locale);
    const acc = p.accuracyBps / 100;
    return {
      title: lt.share.replayTitleTpl
        .replace("{symbol}", p.symbol)
        .replace("{interval}", p.interval)
        .replace("{grade}", replayGradeLabel(acc, p.total, locale))
        .replace("{correct}", `${p.correct}`)
        .replace("{total}", `${p.total}`),
      description: lt.share.replayDescTpl
        .replace("{symbol}", p.symbol)
        .replace("{correct}", `${p.correct}`)
        .replace("{total}", `${p.total}`)
        .replace("{percent}", `${acc.toFixed(0)}`),
      locale,
    };
  }
  // streak
  const p = decodeStreak(path);
  if (!p) return { title: t.share.invalidStreakTitle, description: t.share.invalidBody, locale: "zh" };
  const locale = p.locale;
  const lt = getDict(locale);
  return {
    title: lt.share.streakTitleTpl.replace("{days}", `${p.currentStreak}`),
    description: lt.share.streakDescTpl
      .replace("{days}", `${p.currentStreak}`)
      .replace("{longest}", `${p.longestStreak}`),
    locale,
  };
}

function gradeLabel(percent: number, locale: "zh" | "en"): string {
  if (percent >= 100) return locale === "zh" ? "满分" : "S";
  if (percent >= 80) return locale === "zh" ? "优秀" : "A";
  if (percent >= 60) return locale === "zh" ? "及格" : "B";
  return locale === "zh" ? "待加强" : "C";
}

function replayGradeLabel(accuracy: number, total: number, locale: "zh" | "en"): string {
  // 复用 share-card 里的语义
  if (total < 3) return locale === "zh" ? "待加强" : "C";
  if (accuracy >= 0.7) return locale === "zh" ? "卓越" : "S";
  if (accuracy >= 0.6) return locale === "zh" ? "稳健" : "A";
  if (accuracy >= 0.5) return locale === "zh" ? "及格" : "B";
  return locale === "zh" ? "待加强" : "C";
}

export default async function ShareLandingPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { kind, path } = await params;
  if (!isShareKind(kind)) notFound();
  if (detectKind(path) !== kind) notFound();

  const locale = kindToLocale(kind, path);
  const t = getDict(locale);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <ShareCardPreview kind={kind} path={path} locale={locale} labels={t.share} />

      {/* 站内 CTA：把访客引导进学习入口，而非冷冰冰的离开 */}
      <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-sm font-semibold">{t.share.ctaTitle}</p>
        <p className="mt-1 text-xs text-muted leading-relaxed">{t.share.ctaBody}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={`/${locale}/path`}
            className="rounded-full bg-accent-strong text-white dark:text-[#06281c] font-semibold px-5 py-2 text-sm hover:bg-accent transition"
          >
            {t.share.ctaPath}
          </a>
          <a
            href={`/${locale}/replay`}
            className="rounded-full border border-[var(--accent)]/40 bg-[var(--surface)] text-accent font-medium px-5 py-2 text-sm hover:border-accent/60 transition"
          >
            {t.share.ctaReplay}
          </a>
        </div>
      </div>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: metaTitle(kind, path),
          url: `${SITE_URL}/share/${kind}/${path}`,
          description: metaDesc(kind, path),
          isPartOf: {
            "@type": "WebSite",
            name: "Trade Buty",
            url: SITE_URL,
          },
        }}
      />
    </div>
  );
}

function kindToLocale(kind: ShareKind, path: string): "zh" | "en" {
  if (kind === "quiz") return decodeQuiz(path)?.locale ?? DEFAULT_LOCALE;
  if (kind === "replay") return decodeReplay(path)?.locale ?? DEFAULT_LOCALE;
  return decodeStreak(path)?.locale ?? DEFAULT_LOCALE;
}

function metaTitle(kind: ShareKind, path: string): string {
  return summarizeForMeta(kind, path).title;
}
function metaDesc(kind: ShareKind, path: string): string {
  return summarizeForMeta(kind, path).description;
}
