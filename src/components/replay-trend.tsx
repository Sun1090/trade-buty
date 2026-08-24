"use client";

import { useEffect, useState } from "react";
import { readReplayHistory } from "@/lib/replay-store";

/** 回放训练准确率趋势折线图（SVG，无外部依赖） */
export function ReplayTrend({
  label,
  emptyLabel,
}: {
  label: string;
  emptyLabel: string;
}) {
  const [points, setPoints] = useState<{ at: number; acc: number }[]>([]);

  useEffect(() => {
    const h = readReplayHistory()
      .map((r) => ({
        at: r.at,
        acc: r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0,
      }))
      .slice(-20); // 最近 20 轮
    setPoints(h);
    const onChange = () => {
      const h2 = readReplayHistory()
        .map((r) => ({ at: r.at, acc: r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0 }))
        .slice(-20);
      setPoints(h2);
    };
    window.addEventListener("tb-progress", onChange);
    return () => window.removeEventListener("tb-progress", onChange);
  }, []);

  if (points.length < 2) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="text-sm text-faint">{emptyLabel}</p>
      </div>
    );
  }

  const W = 600;
  const H = 120;
  const pad = 8;
  const maxAcc = 100;
  const minAcc = 0;
  const xs = (i: number) => pad + (i / (points.length - 1)) * (W - pad * 2);
  const ys = (acc: number) => H - pad - (acc / (maxAcc - minAcc)) * (H - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(p.acc).toFixed(1)}`).join(" ");

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-faint mb-3">{label}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        {/* 网格线 */}
        {[25, 50, 75].map((g) => (
          <line key={g} x1={pad} x2={W - pad} y1={ys(g)} y2={ys(g)} stroke="rgba(233,237,245,.06)" />
        ))}
        {/* 折线 */}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
        {/* 数据点 */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xs(i)}
            cy={ys(p.acc)}
            r={2.5}
            fill={p.acc >= 50 ? "var(--accent)" : "var(--down)"}
          >
            <title>{`${points.length - i} 轮前 · ${p.acc}%`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}