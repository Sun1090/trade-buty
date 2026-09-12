"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { highlight, snippetHtml } from "@/lib/search-utils";
import { SYNONYM_GROUPS, scoreWithSynonyms } from "@/lib/search-synonyms";
import { diagnoseNoResults } from "@/lib/search-diagnostics";

interface Entry {
  url: string;
  title: string;
  chapter: string;
  text: string;
}

export function SearchClient({
  dict,
}: {
  dict: {
    placeholder: string;
    resultsTpl: string;
    noResults: string;
    emptyHint: string;
    browseCta: string;
    recentLabel: string;
    suggestTitle: string;
    didYouMean: string;
    triedSynTpl: string;
    gapHint: string;
    filterZeroTpl: string;
    filterZeroCta: string;
    filterLabel: string;
    indexError: string;
    retry: string;
  };
}) {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [filterChapter, setFilterChapter] = useState<string>("");
  const [focusIdx, setFocusIdx] = useState(-1);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestIdx, setSuggestIdx] = useState(-1);
  const [indexError, setIndexError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(JSON.parse(localStorage.getItem("tb-recent-search") ?? "[]"));
  }, []);

  const saveRecent = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, 5);
      if (next.length === prev.length && next.every((term, i) => term === prev[i])) return prev;
      try {
        localStorage.setItem("tb-recent-search", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);


  const results = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    if (!q || !entries) return [];
    return entries
      .map((e) => ({ e, s: scoreWithSynonyms(e, q) }))
      .filter(({ s }) => s > 0)
      .sort((a, b) => b.s - a.s)
      .map(({ e }) => e);
  }, [debouncedQ, entries]);

  // 分页：前 20 条 + 加载更多
  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleResults = results.slice(0, visibleCount);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setVisibleCount(PAGE_SIZE), [query]);

  // 所有篇章（用于筛选 dropdown）
  const allChapters = useMemo(() => {
    if (!entries) return [];
    return [...new Set(entries.map((e) => e.chapter))].sort();
  }, [entries]);

  // 按篇章筛选后的结果
  const filtered = useMemo(() => {
    if (!filterChapter) return visibleResults;
    return visibleResults.filter((r) => r.chapter === filterChapter);
  }, [visibleResults, filterChapter]);

  // 有结果时存为最近搜索；用 debounce 后的 query，避免保存尚未执行搜索的半截输入。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (debouncedQ.trim() && results.length > 0) saveRecent(debouncedQ);
  }, [debouncedQ, results.length, saveRecent]);

  const locale = usePathname()?.split("/")[1] || "en";
  const hotTerms = locale === "en"
    ? ["stop loss", "candlestick", "leverage", "margin", "trend"]
    : ["止损", "K线", "杠杆", "保证金", "趋势"];

  // R10.22：无结果诊断候选池——同义词组词条在前（短、精确），后接索引标题/篇章
  const suggestionCandidates = useMemo(() => {
    const pool: string[] = [];
    const seen = new Set<string>();
    const push = (raw: string) => {
      const t = raw.trim().toLowerCase();
      if (!t || seen.has(t)) return;
      seen.add(t);
      pool.push(raw.trim());
    };
    for (const g of SYNONYM_GROUPS) for (const t of g.terms) push(t);
    for (const e of entries ?? []) {
      push(e.title);
      push(e.chapter);
    }
    return pool;
  }, [entries]);

  // R10.22：零结果诊断——只在全局零命中时计算（复用同义词组匹配 + 编辑距离）
  const diag = useMemo(() => {
    const q = debouncedQ.trim();
    if (!q || results.length > 0 || !entries) return null;
    return diagnoseNoResults(q, { candidates: suggestionCandidates });
  }, [debouncedQ, results.length, entries, suggestionCandidates]);

  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const r of filtered) {
      if (!map.has(r.chapter)) map.set(r.chapter, []);
      map.get(r.chapter)!.push(r);
    }
    return [...map.entries()];
  }, [filtered]);

  // 输入联想：标题命中优先，其次综合分 Top 6
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !entries) return [];
    const titleHits = entries.filter((e) => e.title.toLowerCase().includes(q));
    if (titleHits.length > 0) return titleHits.slice(0, 6);
    return entries
      .map((e) => ({ e, s: scoreWithSynonyms(e, q) }))
      .filter(({ s }) => s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map(({ e }) => e);
  }, [query, entries]);

  // R13.25 / Q2.6：索引加载失败必须有降级 UI（原来的裸 fetch 会让「加载失败」伪装成「无结果」）。
  async function loadIndex(): Promise<boolean> {
    try {
      const res = await fetch("/search-index.json");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("invalid index payload");
      setEntries(data as Entry[]);
      setIndexError(false);
      return true;
    } catch {
      setIndexError(true);
      return false;
    }
  }

  async function onInput(value: string) {
    setQuery(value);
    setSuggestOpen(value.trim().length > 0);
    setSuggestIdx(-1);
    setFocusIdx(-1);
    if (!entries) await loadIndex();
  }

  return (
    <div>
      <div className="relative">
        <input
          type="search"
          maxLength={100}
          value={query}
          onChange={(e) => void onInput(e.target.value)}
          onKeyDown={(e) => {
            if (suggestOpen && suggestions.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              setSuggestIdx((i) =>
                e.key === "ArrowDown"
                  ? Math.min(i + 1, suggestions.length - 1)
                  : Math.max(i - 1, -1)
              );
            } else if (e.key === "Enter" && suggestOpen && suggestIdx >= 0) {
              const entry = suggestions[suggestIdx];
              if (entry) router.push(entry.url);
            } else if (e.key === "Escape") {
              setSuggestOpen(false);
              setFocusIdx(-1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              if (filtered.length > 0) {
                setFocusIdx((i) => Math.min(i + 1, filtered.length - 1));
              }
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setFocusIdx((i) => Math.max(i - 1, -1));
            } else if (e.key === "Enter" && filtered.length > 0) {
              e.preventDefault();
              const entry = filtered[focusIdx] ?? filtered[0];
              if (entry) router.push(entry.url);
            }
          }}
          placeholder={dict.placeholder}
          aria-label={dict.placeholder}
          autoFocus
          onFocus={() => {
            if (query.trim() && suggestions.length > 0) setSuggestOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setSuggestOpen(false), 150);
          }}
          className="w-full rounded-xl border border-[var(--border-strong)] bg-transparent px-4 py-3 pr-16 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-dim)] transition-shadow"
        />
        {!query && (
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-xs text-faint font-mono">
            ⌘K
          </kbd>
        )}
        {suggestOpen && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl shadow-black/30">
            <p className="px-4 pt-2.5 text-[11px] uppercase tracking-widest text-faint">
              {dict.suggestTitle}
            </p>
            <ul className="py-1.5">
              {suggestions.map((s, i) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSuggestOpen(false)}
                    onMouseEnter={() => setSuggestIdx(i)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm transition ${
                      i === suggestIdx
                        ? "bg-[var(--accent-dim)] text-accent"
                        : "text-foreground hover:bg-white/5"
                    }`}
                  >
                    <span aria-hidden className="text-faint">⌕</span>
                    <span
                      className="truncate [&>mark]:bg-accent/30 [&>mark]:text-accent [&>mark]:rounded-sm [&>mark]:px-0.5"
                      dangerouslySetInnerHTML={{
                        __html: highlight(s.title, query.trim().toLowerCase()),
                      }}
                    />
                    <span className="ml-auto shrink-0 text-[11px] text-faint">{s.chapter}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {!query.trim() && recent.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-faint mb-2">{dict.recentLabel}</p>
          <div className="flex flex-wrap gap-2">
            {recent.map((term) => (
              <button
                key={term}
                onClick={() => {
                  setQuery(term);
                  void onInput(term);
                }}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-muted hover:text-accent hover:border-accent/50 transition"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
      {query.trim() && filtered.length > 0 && allChapters.length > 1 && (
        <div className="mt-4 flex items-center gap-2">
          <p className="text-sm text-muted">
            {dict.resultsTpl.replace("{n}", String(filtered.length))}
          </p>
          <select
            value={filterChapter}
            onChange={(e) => setFilterChapter(e.target.value)}
            aria-label={dict.filterLabel}
            className="ml-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs focus:border-accent"
          >
            <option value="">{locale === "en" ? "All chapters" : "全部篇章"}</option>
            {allChapters.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      )}
      {query.trim() && results.length > 0 && filtered.length === 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-muted">
          <span>
            {dict.filterZeroTpl
              .replace("{chapter}", filterChapter)
              .replace("{n}", String(results.length))}
          </span>
          <button
            onClick={() => setFilterChapter("")}
            className="ml-auto text-accent underline underline-offset-4"
          >
            {dict.filterZeroCta}
          </button>
        </div>
      )}
      {query.trim() && indexError && (
        <div
          role="alert"
          data-testid="search-index-error"
          className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center"
        >
          <p className="text-3xl" aria-hidden>⚠️</p>
          <p className="mt-3 font-medium">{dict.indexError}</p>
          <button
            onClick={() => void loadIndex()}
            className="mt-5 inline-flex min-h-10 items-center rounded-full border border-[var(--border-strong)] px-5 py-2.5 font-semibold transition hover:border-accent/60"
          >
            {dict.retry}
          </button>
        </div>
      )}
      {query.trim() && !indexError && results.length === 0 && (
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <p className="text-3xl" aria-hidden>🔍</p>
          <p className="mt-3 font-medium">{dict.noResults}</p>
          <p className="mt-2 text-sm text-muted">{dict.emptyHint}</p>
          <Link
            href={`/${locale}/path`}
            data-testid="search-empty-cta"
            className="mt-5 inline-flex rounded-full bg-accent-strong px-5 py-2.5 font-semibold text-white transition hover:bg-accent dark:text-[#06281c]"
          >
            {dict.browseCta}
          </Link>
          {diag?.kind === "typo" && diag.suggestions.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs text-faint">{dict.didYouMean}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {diag.suggestions.map((term) => (
                  <button
                    key={term}
                    onClick={() => void onInput(term)}
                    className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent-dim)] px-3 py-1 text-xs text-accent transition hover:border-accent/60"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
          {diag?.kind === "coverage-gap" && (
            <div className="mt-5 text-xs text-muted">
              <p>
                {dict.triedSynTpl.replace(
                  "{terms}",
                  diag.tried
                    .filter((t) => t !== debouncedQ.trim().toLowerCase())
                    .join(" · "),
                )}
              </p>
              <p className="mt-1 text-faint">{dict.gapHint}</p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {hotTerms.map((term) => (
              <button
                key={term}
                onClick={() => void onInput(term)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-1 text-xs text-muted hover:text-accent hover:border-[var(--accent)]/40 transition"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
      {groups.map(([chapter, items]) => (
        <div key={chapter} className="mb-8">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)]/30 px-3 py-1 text-xs font-medium text-accent mb-3 mt-6 first:mt-0">
            {chapter}
          </p>
          <ul className="space-y-2.5">
            {items.map((r) => {
              const resultIndex = filtered.indexOf(r);
              return (
                <li key={r.url}>
                  <a
                    href={r.url}
                    data-search-result-index={resultIndex}
                    className={`group block rounded-xl border bg-[var(--surface)] px-5 py-4 hover:border-[var(--accent)]/50 hover:bg-[var(--surface-hover)] hover:-translate-y-0.5 transition-all ${
                      resultIndex === focusIdx
                        ? "border-accent ring-2 ring-[var(--accent-dim)]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <span className="font-medium group-hover:text-accent transition-colors [&>mark]:bg-accent/30 [&>mark]:text-accent [&>mark]:rounded-sm [&>mark]:px-0.5">
                      <span
                        dangerouslySetInnerHTML={{
                          __html: highlight(r.title, query.trim().toLowerCase()),
                        }}
                      />
                    </span>
                    <p
                      className="mt-1 text-sm text-muted [&>mark]:bg-accent/30 [&>mark]:text-accent [&>mark]:rounded-sm [&>mark]:px-0.5"
                      dangerouslySetInnerHTML={{
                        __html: snippetHtml(r.text, query.trim().toLowerCase()),
                      }}
                    />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {visibleCount < results.length && (
        <button
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="mt-6 w-full rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-dim)] hover:border-accent/60 text-accent font-medium py-3 text-sm transition"
        >
          {locale === "en" ? "Load more" : "加载更多"}
        </button>
      )}
    </div>
  );
}
