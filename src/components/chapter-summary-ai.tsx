"use client";

import { useState } from "react";
import { isAiGloballyDisabled } from "@/lib/ai-toggle";
import { trackAiClick } from "@/lib/analytics";

interface Dict {
  title: string;
  generate: string;
  generating: string;
  error: string;
}

const SUMMARY_TTL = 7 * 24 * 60 * 60 * 1000; // R3.5：同章 7 天有效

/** AI 章节摘要卡片：点击生成，localStorage 缓存 7 天避免重复调用 */
export function ChapterSummaryAi({
  chapter,
  title,
  locale,
  aiEnabled = true,
  dict,
}: {
  chapter: string;
  title: string;
  locale: string;
  /** R3.9：无 key 环境由服务端页传入 false */
  aiEnabled?: boolean;
  dict: Dict;
}) {
  const cacheKey = `tb-summary-v2-${locale}-${chapter}`;
  const [summary, setSummary] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { text: string; at: number };
      if (Date.now() - parsed.at > SUMMARY_TTL) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      return parsed.text;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  // R3.6：失败降级——隐藏整个入口，不展示错误
  const [failed, setFailed] = useState(false);

  // R3.9/R3.10：AI 关闭时隐藏入口
  if (aiEnabled === false || isAiGloballyDisabled()) return null;

  async function generate() {
    setLoading(true);
    setFailed(false);
    trackAiClick("chapter-summary", { chapter });
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
          localStorage.setItem(cacheKey, JSON.stringify({ text: data.summary, at: Date.now() }));
        } catch {
          // ignore
        }
      } else {
        setSummary(title);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  if (failed && !summary) return null;

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
      {summary && <p className="text-sm text-muted leading-relaxed">{summary}</p>}
    </div>
  );
}