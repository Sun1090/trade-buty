"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
  dict: { placeholder: string; resultsTpl: string; noResults: string };
}) {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const pathname = usePathname() ?? "";
  const locale = pathname.split("/")[1] || "zh";

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
      <ul className="mt-4 space-y-3">
        {results.map((r) => (
          <li key={r.url}>
            <Link
              href={`/${locale}${r.url}`}
              className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 hover:border-[var(--accent)]/60 transition"
            >
              <span className="font-medium">{r.title}</span>
              <span className="ml-2 text-xs text-faint">{r.chapter}</span>
              <p
                className="mt-1 text-sm text-muted [&>mark]:bg-accent/30 [&>mark]:text-accent [&>mark]:rounded-sm [&>mark]:px-0.5"
                dangerouslySetInnerHTML={{
                  __html: snippetHtml(r.text, query.trim().toLowerCase()),
                }}
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
