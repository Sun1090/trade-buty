"use client";

import { useEffect, useState } from "react";
import { readReplayHistory } from "@/lib/replay-store";
import { localDateStr } from "@/lib/date-utils";

/** 折线图最少要几轮记录：空态文案里的数字读这个常量 */
export const REPLAY_TREND_MIN_ROUNDS = 2;

/** 折线只画最近这么几轮：脚注里的数字读这个常量，两处 slice 也是它 */
export const REPLAY_TREND_POINTS = 20;

/** 回放训练正确率趋势折线图（SVG，无外部依赖） */
export function ReplayTrend({
  label,
  emptyLabel,
  scopeLabel,
}: {
  label: string;
  emptyLabel: string;
  /** 折线窗口那句脚注，`{n}` 由 REPLAY_TREND_POINTS 代入 */
  scopeLabel: string;
}) {
  const [points, setPoints] = useState<{ at: number; acc: number }[]>([]);

  useEffect(() => {
    const h = readReplayHistory()
      .map((r) => ({
        at: r.at,
        acc: r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0,
      }))
      .slice(-REPLAY_TREND_POINTS);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPoints(h);
    const onChange = () => {
      const h2 = readReplayHistory()
        .map((r) => ({ at: r.at, acc: r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0 }))
        .slice(-REPLAY_TREND_POINTS);
      setPoints(h2);
    };
    window.addEventListener("tb-progress", onChange);
    return () => window.removeEventListener("tb-progress", onChange);
  }, []);

  if (points.length < REPLAY_TREND_MIN_ROUNDS) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="text-sm text-faint">
          {emptyLabel.replace("{n}", String(REPLAY_TREND_MIN_ROUNDS))}
        </p>
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
      <p className="-mt-2 mb-3 text-xs text-faint">
        {scopeLabel.replace("{n}", String(REPLAY_TREND_POINTS))}
      </p>
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
            <title>{`${localDateStr(new Date(p.at))} · ${p.acc}%`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}