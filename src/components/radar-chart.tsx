"use client";

import { useEffect, useState } from "react";
import { readQuizAttemptLedger } from "@/lib/quiz-attempt-ledger";
import { readQuizProgress } from "@/lib/quiz-store";
import { quizScorePct } from "@/lib/quiz-score";
import { QUIZZES } from "@/lib/quizzes";

/** 少于这个根数连多边形都围不出来，空态文案要按它说话（`stats-client` 借这一个常量写提示）。 */
export const RADAR_MIN_AXES = 3;
/** 再多就糊成一团，读不出轴了。 */
const RADAR_MAX_AXES = 5;

/**
 * 知识点掌握度雷达图：只画**做过**的章节，按最近一次作答排前 5 根轴。
 * 没做过的章节记 0 分等于把「没测过」画成「没掌握」，所以它不进轴；
 * 不足 `RADAR_MIN_AXES` 章时给空态，而不是围一个全 0 的形状。
 */
export function RadarChart({ label, emptyLabel }: { label: string; emptyLabel: string }) {
  const [axes, setAxes] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    const update = () => {
      const lastAttempt = new Map<string, number>();
      for (const entry of Object.values(readQuizAttemptLedger())) {
        // 账本类型对 localStorage 一律放宽（`QuizAttemptEntry` 的字段是 unknown），这里自己收
        const at = typeof entry.at === "number" && Number.isFinite(entry.at) ? entry.at : null;
        if (entry.chapter === undefined || at === null) continue;
        const seen = lastAttempt.get(entry.chapter) ?? 0;
        if (at > seen) lastAttempt.set(entry.chapter, at);
      }
      const attempted: { slug: string; index: number; best: number }[] = [];
      Object.keys(QUIZZES).forEach((slug, index) => {
        const progress = readQuizProgress(slug);
        if (progress?.done) attempted.push({ slug, index, best: progress.best });
      });
      // 账本里没有日期的（老数据）排在有日期的之后，但不给它编一个日期
      const ordered = attempted.sort(
        (a, b) =>
          (lastAttempt.get(b.slug) ?? 0) - (lastAttempt.get(a.slug) ?? 0) || a.index - b.index,
      );
      const picked = ordered.slice(0, RADAR_MAX_AXES);
      if (picked.length < RADAR_MIN_AXES) {
        setAxes([]);
        return;
      }
      setAxes(
        picked.map((row) => ({
          name: QUIZZES[row.slug].title.replace(/^\d+\s*[·•]?\s*/, "").slice(0, 8),
          value: quizScorePct(row.best, QUIZZES[row.slug].questions.length),
        })),
      );
    };
    update();
    window.addEventListener("tb-progress", update);
    return () => window.removeEventListener("tb-progress", update);
  }, []);

  if (axes.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="text-sm text-faint">{emptyLabel}</p>
      </div>
    );
  }

  const N = axes.length;
  const W = 260;
  const H = 260;
  const cx = W / 2;
  const cy = H / 2;
  const r = 90;

  const pt = (i: number, value: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    const rr = (value / 100) * r;
    return { x: cx + rr * Math.cos(angle), y: cy + rr * Math.sin(angle) };
  };

  const polygon = axes.map((a, i) => pt(i, a.value)).map((p) => `${p.x},${p.y}`).join(" ");
  const gridPts = (level: number) =>
    axes.map((_, i) => pt(i, (level / 4) * 100)).map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-faint mb-3">{label}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xs mx-auto" role="img" aria-label={label}>
        {[1, 2, 3, 4].map((g) => (
          <polygon key={g} points={gridPts(g)} fill="none" stroke="rgba(233,237,245,.08)" />
        ))}
        <polygon points={polygon} fill="var(--accent-dim)" stroke="var(--accent)" strokeWidth={2} />
        {axes.map((a, i) => {
          const pos = pt(i, 100);
          const lx = cx + (pos.x - cx) * 1.3;
          const ly = cy + (pos.y - cy) * 1.3;
          return (
            <g key={a.name}>
              <line x1={cx} y1={cy} x2={pos.x} y2={pos.y} stroke="rgba(233,237,245,.1)" />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="var(--faint)" fontSize="9">
                {a.name}
              </text>
              {/* 刻度点 */}
              <circle cx={pos.x} cy={pos.y} r={2.5} fill={a.value >= 50 ? "var(--accent)" : "var(--down)"} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}