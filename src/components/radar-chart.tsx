"use client";

import { useEffect, useState } from "react";
import { readQuizProgress } from "@/lib/quiz-store";
import { QUIZZES } from "@/lib/quizzes";

/** 知识点掌握度雷达图：5 个最新测验维度的平均正确率（SVG） */
export function RadarChart({ label, emptyLabel }: { label: string; emptyLabel: string }) {
  const [axes, setAxes] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    const update = () => {
      const prog = Object.keys(QUIZZES).map((slug) => ({
        name: QUIZZES[slug].title.replace(/^\d+\s*[·•]?\s*/, "").slice(0, 8),
        value: (() => {
          const p = readQuizProgress(slug);
          if (!p?.done) return 0;
          return Math.round((p.best / QUIZZES[slug].questions.length) * 100);
        })(),
      }));
      setAxes(prog.slice(0, 5)); // 最近 5 个
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