"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

interface Entry {
  url: string;
  title: string;
  chapter: string;
  text: string;
}

function score(entry: Entry, q: string): number {
  const title = entry.title.toLowerCase();
  const chapter = entry.chapter.toLowerCase();
  const text = entry.text.toLowerCase();
  let s = 0;
  if (title.includes(q)) s += 100;
  if (chapter.includes(q)) s += 30;
  const hits = text.split(q).length - 1;
  s += Math.min(hits, 10) * 2;
  return s;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlight(text: string, q: string): string {
  const safe = escapeHtml(text);
  if (!q) return safe;
  return safe.replace(
    new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
    (m) => `<mark>${m}</mark>`
  );
}

function snippetHtml(text: string, q: string): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return escapeHtml(text.slice(0, 80));
  const start = Math.max(0, idx - 30);
  const raw =
    (start > 0 ? "…" : "") + text.slice(start, idx + q.length + 60) + "…";
  return highlight(raw, q);
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
  };
}) {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);


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

  const locale = usePathname()?.split("/")[1] || "zh";

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
      <input
        type="search"
        value={query}
        onChange={(e) => onInput(e.target.value)}
        placeholder={dict.placeholder}
        autoFocus
        className="w-full rounded-lg border border-[var(--border-strong)] bg-transparent px-4 py-3 outline-none focus:border-accent"
      />
      {query.trim() && (
        <p className="mt-4 text-sm text-muted">
          {results.length > 0 ? dict.resultsTpl.replace("{n}", String(results.length)) : dict.noResults}
        </p>
      )}
      {query.trim() && results.length === 0 && (
        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm">
          <p className="font-medium">{dict.noResults}</p>
          <p className="mt-2 text-muted">
            {dict.emptyHint}{" "}
            <a href={`/${locale}/path`} className="text-accent underline underline-offset-4">
              {dict.browseCta}
            </a>
          </p>
        </div>
      )}
      {groups.map(([chapter, items]) => (
        <div key={chapter} className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-faint mb-3 mt-6 first:mt-0">
            {chapter}
          </p>
          <ul className="space-y-2.5">
            {items.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 hover:border-[var(--accent)]/60 transition"
                >
                  <span className="font-medium [&>mark]:bg-accent/30 [&>mark]:text-accent [&>mark]:rounded-sm [&>mark]:px-0.5">
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
