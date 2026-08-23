"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { score, highlight, snippetHtml } from "@/lib/search-utils";

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
  };
}) {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(JSON.parse(localStorage.getItem("tb-recent-search") ?? "[]"));
  }, []);

  function saveRecent(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, 5);
      try {
        localStorage.setItem("tb-recent-search", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }


  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !entries) return [];
    return entries
      .map((e) => ({ e, s: score(e, q) }))
      .filter(({ s }) => s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 20)
      .map(({ e }) => e);
  }, [query, entries]);

  // 有结果时存为最近搜索（故意只依赖 results.length，不依赖 query）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (query.trim() && results.length > 0) saveRecent(query);
  }, [results.length]);

  const locale = usePathname()?.split("/")[1] || "en";
  const hotTerms = locale === "en"
    ? ["stop loss", "candlestick", "leverage", "margin", "trend"]
    : ["止损", "K线", "杠杆", "保证金", "趋势"];

  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const r of results) {
      if (!map.has(r.chapter)) map.set(r.chapter, []);
      map.get(r.chapter)!.push(r);
    }
    return [...map.entries()];
  }, [results]);

  async function onInput(value: string) {
    setQuery(value);
    if (!entries) {
      const res = await fetch("/search-index.json");
      setEntries(await res.json());
    }
  }

  return (
    <div>
      <div className="relative">
        <input
          type="search"
          maxLength={100}
          value={query}
          onChange={(e) => onInput(e.target.value)}
          placeholder={dict.placeholder}
          aria-label={dict.placeholder}
          autoFocus
          className="w-full rounded-xl border border-[var(--border-strong)] bg-transparent px-4 py-3 pr-16 outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-dim)] transition-shadow"
        />
        {!query && (
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-xs text-faint font-mono">
            ⌘K
          </kbd>
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
                  onInput(term);
                }}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-muted hover:text-accent hover:border-accent/50 transition"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
      {query.trim() && (
        <p className="mt-4 text-sm text-muted">
          {results.length > 0 ? dict.resultsTpl.replace("{n}", String(results.length)) : dict.noResults}
        </p>
      )}
      {query.trim() && results.length === 0 && (
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <p className="text-3xl" aria-hidden>🔍</p>
          <p className="mt-3 font-medium">{dict.noResults}</p>
          <p className="mt-2 text-sm text-muted">
            {dict.emptyHint}{" "}
            <a href={`/${locale}/path`} className="text-accent underline underline-offset-4">
              {dict.browseCta}
            </a>
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {hotTerms.map((term) => (
              <button
                key={term}
                onClick={() => onInput(term)}
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
            {items.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  className="group block rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 hover:border-[var(--accent)]/50 hover:bg-[var(--surface-hover)] hover:-translate-y-0.5 transition-all"
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
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
