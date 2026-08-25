import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/changelog">): Promise<Metadata> {
  return { title: "Changelog", robots: { index: false, follow: false } };
}

/** 从 git log 获取最近变更 */
function getRecentChanges(): { hash: string; date: string; message: string }[] {
  try {
    const { execSync } = require("child_process");
    const output = execSync("git log --oneline --date=short --format='%h|%ad|%s' -15", {
      cwd: process.cwd(),
      encoding: "utf-8",
    });
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

export default async function ChangelogPage({ params }: PageProps<"/[locale]/changelog">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const changes = getRecentChanges();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-5 py-10">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {locale === "en" ? "Changelog" : "更新日志"}
        </p>
        <h1 className="text-2xl font-bold mt-3">
          {locale === "en" ? "What's new" : "最近更新"}
        </h1>
      </div>
      {changes.length === 0 ? (
        <p className="text-sm text-muted">{locale === "en" ? "No changelog data available." : "暂无更新日志。"}</p>
      ) : (
        <ul className="space-y-4">
          {changes.map((c) => (
            <li key={c.hash} className="border-l-2 border-[var(--accent)]/40 pl-4 py-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-mono text-[10px] text-faint">{c.hash}</span>
                <span className="text-xs text-faint">{c.date}</span>
              </div>
              <p className="text-sm text-muted font-mono">{c.message}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-xs text-faint">
        {locale === "en" ? "See full history on GitHub" : "查看完整历史"}
        :{" "}
        <a href="https://github.com/Sun1090/trade-buty/commits/main" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4">
          github.com/Sun1090/trade-buty
        </a>
      </p>
    </div>
  );
}