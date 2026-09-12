import { notFound } from "next/navigation";
import { execSync } from "child_process";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/metadata";
import { HeroCard } from "@/components/hero-card";
import {
  formatReleaseDate,
  releaseNotes,
  unreleasedNote,
} from "@/lib/release-notes";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/changelog">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const m = getDict(locale).pageMeta;
  return buildPageMetadata({
    locale,
    title: m.changelogTitle,
    description: m.changelogDesc,
    path: `/${locale}/changelog`,
    noindex: true,
  });
}

/** 从 git log 获取最近提交；浅克隆或无 git 环境时返回空数组。 */
function getRecentChanges(): { hash: string; date: string; message: string }[] {
  try {
    const output = execSync(
      "git log --oneline --date=short --format='%h|%ad|%s' -15",
      {
        cwd: process.cwd(),
        encoding: "utf-8",
      },
    );
    return output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line: string) => {
        const [hash, date, ...msgParts] = line.split("|");
        return { hash, date, message: msgParts.join("|") || "" };
      });
  } catch {
    return [];
  }
}

const COPY = {
  zh: {
    heroLabel: "更新日志",
    heroTitle: "最近更新",
    intro:
      "按版本记录已上线的能力。产品级发布说明与仓库中的 CHANGELOG.md 共用同一份数据。",
    unreleased: "未发布",
    commits: "最近提交",
    commitsHint: "这里只是技术提交记录，用于核对发布说明与仓库历史。",
    refs: "发布复盘",
    full: "查看完整历史",
  },
  en: {
    heroLabel: "Changelog",
    heroTitle: "What's new",
    intro:
      "Shipped capabilities by version. These product notes share a single source with the repository CHANGELOG.md.",
    unreleased: "Unreleased",
    commits: "Recent commits",
    commitsHint:
      "Raw commit log, kept for cross-checking release notes against repository history.",
    refs: "Release review",
    full: "See full history on GitHub",
  },
} as const;

export default async function ChangelogPage({
  params,
}: PageProps<"/[locale]/changelog">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = COPY[locale];
  const commits = getRecentChanges();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-5 py-10 sm:py-14">
      <HeroCard label={copy.heroLabel} title={copy.heroTitle}>
        {copy.intro}
      </HeroCard>

      {unreleasedNote && (
        <section className="mb-10" aria-labelledby="changelog-unreleased">
          <h2
            id="changelog-unreleased"
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              {copy.unreleased}
            </span>
            <time dateTime={unreleasedNote.date} className="text-xs text-faint">
              {formatReleaseDate(unreleasedNote.date, locale)}
            </time>
          </h2>
          <ul className="mt-3 space-y-2">
            {unreleasedNote.highlights[locale].map((item) => (
              <li
                key={item}
                className="border-l-2 border-[var(--accent)]/40 pl-4 text-sm text-muted"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="space-y-10">
        {releaseNotes.map((release) => (
          <section
            key={release.version}
            aria-labelledby={`changelog-${release.version}`}
          >
            <h2
              id={`changelog-${release.version}`}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
            >
              <span className="font-mono text-sm text-accent">
                v{release.version}
              </span>
              <span className="text-lg font-semibold">
                {release.name[locale]}
              </span>
              <time dateTime={release.date} className="text-xs text-faint">
                {formatReleaseDate(release.date, locale)}
              </time>
            </h2>
            <ul className="mt-3 space-y-2">
              {release.highlights[locale].map((item) => (
                <li key={item} className="flex gap-3 text-sm text-muted">
                  <span
                    aria-hidden
                    className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {release.docs.length > 0 && (
              <p className="mt-3 text-xs text-faint">
                {copy.refs}:{" "}
                {release.docs.map((doc, index) => (
                  <span key={doc}>
                    {index > 0 && " · "}
                    <a
                      href={`https://github.com/Sun1090/trade-buty/blob/main/${doc}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline underline-offset-4"
                    >
                      {doc}
                    </a>
                  </span>
                ))}
              </p>
            )}
          </section>
        ))}
      </div>

      {commits.length > 0 && (
        <section className="mt-12" aria-labelledby="changelog-commits">
          <h2 id="changelog-commits" className="text-sm font-semibold">
            {copy.commits}
          </h2>
          <p className="mt-1 text-xs text-faint">{copy.commitsHint}</p>
          <ul className="mt-4 space-y-3">
            {commits.map((commit) => (
              <li
                key={commit.hash}
                className="border-l-2 border-[var(--border)] pl-4 py-1"
              >
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-[10px] text-faint">
                    {commit.hash}
                  </span>
                  <span className="text-xs text-faint">{commit.date}</span>
                </div>
                <p className="text-sm text-muted font-mono">{commit.message}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-xs text-faint">
        {copy.full}:{" "}
        <a
          href="https://github.com/Sun1090/trade-buty/commits/main"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-4"
        >
          github.com/Sun1090/trade-buty
        </a>
      </p>
    </div>
  );
}
