"use client";

import { useEffect, useState } from "react";
import { getDict, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import type { MergeSummary } from "@/lib/sync-layer";

/**
 * R9.6/R9.7：登录后从云端合并数据时弹出一次性 toast，
 * 告诉用户"已为你同步 N 篇进度 / N 条错题 / N 个章节成绩提升"。
 *
 * 设计要点：
 * - 不阻塞登录流程，3 秒后自动消失，可手动关
 * - 同一个 userId 同一会话只弹一次（用 sessionStorage 标记，避免每次 hydrateFromCloud 都触发）
 * - 无 summary 时不渲染（hasAny=false → null）
 */
export function SyncSummaryToast() {
  const [summary, setSummary] = useState<MergeSummary | null>(null);

  useEffect(() => {
    function onSummary(e: Event) {
      const detail = (e as CustomEvent<MergeSummary>).detail;
      if (!detail || !detail.hasAny) return;
      // 用 sessionStorage 去重：每次页面加载只消费一次
      try {
        if (sessionStorage.getItem("tb-merge-summary-shown") === "1") return;
        sessionStorage.setItem("tb-merge-summary-shown", "1");
      } catch {
        // ignore
      }
      setSummary(detail);
      // 8 秒后自动消失
      window.setTimeout(() => setSummary(null), 8000);
    }
    window.addEventListener("tb-merge-summary", onSummary);
    return () => window.removeEventListener("tb-merge-summary", onSummary);
  }, []);

  if (!summary) return null;

  // 客户端从路径里读 locale
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  const seg = path.split("/").filter(Boolean)[0];
  const locale = isLocale(seg) ? seg : DEFAULT_LOCALE;
  const t = getDict(locale).auth;

  const lines: string[] = [];
  if (summary.newProgress > 0) lines.push(t.syncSummaryProgressTpl.replace("{n}", String(summary.newProgress)));
  if (summary.newWrong > 0) lines.push(t.syncSummaryWrongTpl.replace("{n}", String(summary.newWrong)));
  if (summary.quizImprovements > 0) lines.push(t.syncSummaryQuizTpl.replace("{n}", String(summary.quizImprovements)));
  if (summary.newReplays > 0) lines.push(t.syncSummaryReplayTpl.replace("{n}", String(summary.newReplays)));

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[80] max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--background)]/95 p-4 shadow-xl backdrop-blur-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--foreground)]">{t.syncSummaryTitle}</p>
        <button
          type="button"
          aria-label="dismiss"
          onClick={() => setSummary(null)}
          className="text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ×
        </button>
      </div>
      <ul className="space-y-1 text-xs text-[var(--muted)]">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setSummary(null)}
        className="mt-3 w-full rounded-lg bg-[var(--accent-dim)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-dim)]/70"
      >
        {t.syncSummaryDismiss}
      </button>
    </div>
  );
}
