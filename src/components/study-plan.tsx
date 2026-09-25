"use client";

import { useState } from "react";

interface PlanDict {
  generate: string;
  generating: string;
  title: string;
  /** 失败与「没登录」是两件事：这张卡在未登录的 /stats 上也在，点下去必定 401 */
  error: string;
  loginRequired: string;
}

export function StudyPlan({
  doneChapters,
  wrongChapters,
  currentChapter,
  dict,
}: {
  doneChapters: string[];
  wrongChapters: string[];
  currentChapter: string;
  dict: PlanDict;
}) {
  const [plan, setPlan] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    setFailed(null);
    try {
      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doneChapters, wrongChapters, currentChapter }),
      });
      if (res.status === 401) {
        setFailed(dict.loginRequired);
        return;
      }
      if (!res.ok) {
        setFailed(dict.error);
        return;
      }
      const data = await res.json();
      setPlan(data.plan);
    } catch {
      setFailed(dict.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-sm">{dict.title}</p>
        {!plan && (
          <button
            onClick={generate}
            disabled={loading}
            className="text-xs rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-medium px-4 py-1.5 transition disabled:opacity-50"
          >
            {loading ? dict.generating : dict.generate}
          </button>
        )}
      </div>
      {/* 失败只写那句失败：那颗「生成学习计划」按钮（`!plan` 时在场）不能跟着一起消失，
          否则用户除了刷新页面没有第二次入口。屏幕上没有一颗叫「重试」的按钮，注释也不许造。 */}
      {failed && <p className="text-sm text-down leading-relaxed">{failed}</p>}
      {plan && <p className="text-sm text-muted leading-relaxed">{plan}</p>}
    </div>
  );
}