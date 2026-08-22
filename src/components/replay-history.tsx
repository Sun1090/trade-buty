"use client";

import { useEffect, useState } from "react";
import { readReplayHistory, type ReplayRecord } from "@/lib/replay-store";
import { useLocalProgress } from "@/components/use-local-progress";

export interface HistoryDict {
  histTitle: string;
  histRounds: string;
  histAccuracy: string;
  histEmpty: string;
  histRecent: string;
}

function acc(r: ReplayRecord): number {
  return r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
}

/** 训练记录面板：监听 tb-progress 事件实时刷新 */
export function ReplayHistory({ dict }: { dict: HistoryDict }) {
  const progress = useLocalProgress(); // 仅用于触发重渲染（错题/进度共用事件）
  void progress;
  const [history, setHistory] = useState<ReplayRecord[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(readReplayHistory());
    const onChange = () => setHistory(readReplayHistory());
    window.addEventListener("tb-progress", onChange);
    return () => window.removeEventListener("tb-progress", onChange);
  }, []);

  const rounds = history.length;
  const totalQ = history.reduce((s, r) => s + r.total, 0);
  const totalC = history.reduce((s, r) => s + r.correct, 0);
  const overall = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : null;

  if (rounds === 0) {
    return (
      <p className="mt-8 text-sm text-faint">{dict.histEmpty}</p>
    );
  }

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-faint mb-4">
        {dict.histTitle}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
          <p className="font-mono text-2xl font-bold text-accent">{rounds}</p>
          <p className="mt-1 text-xs text-faint">{dict.histRounds}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
          <p className="font-mono text-2xl font-bold text-accent">{overall}%</p>
          <p className="mt-1 text-xs text-faint">{dict.histAccuracy}</p>
        </div>
      </div>
      <ul className="space-y-1.5">
        {[...history].reverse().slice(0, 10).map((r) => (
          <li
            key={r.at}
            className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-mono text-xs"
          >
            <span className="text-muted truncate">
              {new Date(r.at).toLocaleString()} · {r.symbol} {r.interval}
            </span>
            <span className={acc(r) >= 50 ? "text-accent shrink-0" : "text-down shrink-0"}>
              {r.correct}/{r.total} · {acc(r)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
