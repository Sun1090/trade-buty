"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

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

function snippet(text: string, q: string): string {
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return text.slice(0, 80);
  const start = Math.max(0, idx - 30);
  return (start > 0 ? "…" : "") + text.slice(start, idx + q.length + 60) + "…";
}

export default function SearchPage() {
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

  async function onInput(value: string) {
    setQuery(value);
    if (!entries) {
      const res = await fetch("/search-index.json");
      setEntries(await res.json());
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">搜索课程</h1>
      <input
        type="search"
        value={query}
        onChange={(e) => onInput(e.target.value)}
        placeholder="输入关键词，如：止损、保证金、K 线…"
        autoFocus
        className="w-full rounded-lg border border-black/15 dark:border-white/20 bg-transparent px-4 py-3 outline-none focus:border-blue-500"
      />
      {query.trim() && (
        <p className="mt-4 text-sm opacity-60">
          {results.length > 0 ? `${results.length} 条结果` : "没有匹配的结果"}
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {results.map((r) => (
          <li key={r.url}>
            <Link
              href={r.url}
              className="block rounded-lg border border-black/10 dark:border-white/15 px-5 py-4 hover:border-blue-500/60 transition"
            >
              <span className="font-medium">{r.title}</span>
              <span className="ml-2 text-xs opacity-40">{r.chapter}</span>
              <p className="mt-1 text-sm opacity-60">{snippet(r.text, query.trim().toLowerCase())}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
