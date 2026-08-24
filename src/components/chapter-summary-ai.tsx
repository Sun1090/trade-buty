"use client";

import { useState } from "react";

interface Dict {
  title: string;
  generate: string;
  generating: string;
  error: string;
}

/** AI 章节摘要卡片：点击生成，localStorage 缓存避免重复调用 */
export function ChapterSummaryAi({
  chapter,
  title,
  locale,
  dict,
}: {
  chapter: string;
  title: string;
  locale: string;
  dict: Dict;
}) {
  const cacheKey = `tb-summary-${locale}-${chapter}`;
  const [summary, setSummary] = useState<string | null>(() => {
    try {
      return localStorage.getItem(cacheKey);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter, title, locale }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      if (data.summary) {
        setSummary(data.summary);
        try {
          localStorage.setItem(cacheKey, data.summary);
        } catch {
          // ignore
        }
      } else {
        setSummary(title);
      }
    } catch {
      setError(dict.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="font-semibold text-sm">🤖 {dict.title}</p>
        {!summary && (
          <button
            onClick={generate}
            disabled={loading}
            className="text-xs rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-medium px-4 py-1.5 transition disabled:opacity-50 shrink-0"
          >
            {loading ? dict.generating : dict.generate}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-down">{error}</p>}
      {summary && <p className="text-sm text-muted leading-relaxed">{summary}</p>}
    </div>
  );
}