"use client";

import { useState } from "react";

interface PlanDict {
  generate: string;
  generating: string;
  title: string;
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
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doneChapters, wrongChapters, currentChapter }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setPlan(data.plan);
    } catch {
      setPlan("暂时无法生成学习计划，请稍后重试。");
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
      {plan && <p className="text-sm text-muted leading-relaxed">{plan}</p>}
    </div>
  );
}