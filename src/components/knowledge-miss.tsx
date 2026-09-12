import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import type { SuggestibleItem } from "@/lib/url-suggest";

interface Props {
  locale: Locale;
  kind: "chapter" | "doc";
  heading: string;
  hint?: string;
  suggestTitle: string;
  searchCta: string;
  pathCta: string;
  suggestions: SuggestibleItem[];
}

/**
 * R13.18：知识库软 404 的统一出口。
 *
 * 搜索引擎可能把已删除或改名后的旧 URL 带给用户；页面除“最接近的课程”外，
 * 必须保留搜索与学习路线两条明确出口，且全部按当前 locale 路由。
 */
export function KnowledgeMiss({
  locale,
  kind,
  heading,
  hint,
  suggestTitle,
  searchCta,
  pathCta,
  suggestions,
}: Props) {
  const suggestionsTestId = kind === "chapter" ? "chapter-suggestions" : "doc-suggestions";
  const List = kind === "chapter" ? "ul" : "ol";

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-5">
      <p className="font-mono text-4xl text-accent">404</p>
      <h1 className="mt-4 text-2xl font-bold">{heading}</h1>
      {hint && <p className="mt-2 text-sm text-muted">{hint}</p>}

      <div
        className="mt-6 flex flex-wrap gap-3"
        data-testid={`${kind}-no-result-cta`}
      >
        <Link
          href={`/${locale}/search`}
          className="rounded-full bg-accent-strong px-5 py-2.5 font-semibold text-white transition hover:bg-accent dark:text-[#06281c]"
        >
          🔍 {searchCta}
        </Link>
        <Link
          href={`/${locale}/path`}
          className="rounded-full border border-border-strong px-5 py-2.5 font-medium transition hover:border-accent/60"
        >
          {pathCta} →
        </Link>
      </div>

      {suggestions.length > 0 && (
        <>
          <p className="mb-3 mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {suggestTitle}
          </p>
          <List
            className={kind === "chapter" ? "grid gap-2.5 sm:grid-cols-2" : "space-y-2.5"}
            data-testid={suggestionsTestId}
          >
            {suggestions.map((suggestion) => (
              <li key={suggestion.href}>
                <Link
                  href={suggestion.href}
                  className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-3 transition hover:border-[var(--accent)]/60"
                >
                  <span className="font-semibold">{suggestion.title}</span>
                  <span className="mt-0.5 block font-mono text-xs text-faint">
                    {suggestion.slug}
                  </span>
                </Link>
              </li>
            ))}
          </List>
        </>
      )}
    </div>
  );
}
