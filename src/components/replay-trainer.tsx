"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { fetchRandomHistoryWindow, type Kline } from "@/lib/binance";
import { saveReplayRecord, saveReplayBest } from "@/lib/replay-store";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"] as const;
const SYMBOL_NAMES: Record<string, string> = {
  BTCUSDT: "Bitcoin",
  ETHUSDT: "Ethereum",
  BNBUSDT: "BNB",
  SOLUSDT: "Solana",
};
const INTERVALS = ["15m", "1h", "4h", "1d"] as const;
const SPEEDS = [1, 2, 4] as const;
const CONTEXT = 30;

export interface ReplayDict {
  newRound: string;
  play: string;
  pause: string;
  step: string;
  speed: string;
  modeFree: string;
  modeGuess: string;
  guessPrompt: string;
  up: string;
  down: string;
  feedbackUp: string;
  feedbackDown: string;
  youGot: string;
  summaryTitle: string;
  streak: string;
  best: string;
  accuracy: string;
  rounds: string;
  contextNote: string;
  disclaimer: string;
}

interface GuessState {
  streak: number;
  best: number;
  correct: number;
  total: number;
  /** 当前待预测：null 表示已预测等待揭晓 */
  pending: "up" | "down" | null;
  lastFeedback: string | null;
}

function gradeOf(total: number, correct: number): string {
  if (total === 0) return "-";
  const acc = correct / total;
  if (acc >= 0.7) return "S";
  if (acc >= 0.6) return "A";
  if (acc >= 0.5) return "B";
  return "C";
}

export function ReplayTrainer({ dict }: { dict: ReplayDict }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [symbol, setSymbol] = useState<string>("BTCUSDT");
  const [interval_, setInterval_] = useState<string>("1h");
  const [round, setRound] = useState(0);
  const [klines, setKlines] = useState<Kline[] | null>(null);
  const [idx, setIdx] = useState(CONTEXT);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [guessMode, setGuessMode] = useState(false);
  const [guess, setGuess] = useState<GuessState>({
    streak: 0,
    best: 0,
    correct: 0,
    total: 0,
    pending: null,
    lastFeedback: null,
  });
  const [error, setError] = useState(false);
  const savedRoundRef = useRef(0);

  useEffect(() => {
    if (
      guessMode &&
      klines &&
      idx >= klines.length &&
      guess.total > 0 &&
      savedRoundRef.current !== round
    ) {
      savedRoundRef.current = round;
      saveReplayRecord({
        symbol,
        interval: interval_,
        total: guess.total,
        correct: guess.correct,
        bestStreak: guess.best,
      });
    }
  }, [guessMode, klines, idx, guess.total, guess.correct, guess.best, round, symbol, interval_]);

  // 载入随机历史窗口
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(false);
     
    setPlaying(false);
    fetchRandomHistoryWindow(symbol, interval_)
      .then((data) => {
        if (cancelled) return;
        setKlines(data);
        setIdx(CONTEXT);
        setGuess((g) => ({ ...g, pending: null, lastFeedback: null }));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, interval_, round]);

  // 图表初始化
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: getComputedStyle(document.documentElement)
          .getPropertyValue("--muted")
          .trim(),
        fontFamily:
          "var(--font-geist-sans), -apple-system, 'PingFang SC', sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(233,237,245,.05)" },
        horzLines: { color: "rgba(233,237,245,.05)" },
      },
      autoSize: true,
    });
    chartRef.current = chart;
    seriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#f87171",
      borderVisible: false,
      wickUpColor: "#34d399",
      wickDownColor: "#f87171",
    });
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // 数据变化 → 全量重设
  useEffect(() => {
    if (!klines || !seriesRef.current) return;
    seriesRef.current.setData(
      klines.slice(0, idx).map((k) => ({
        time: k.time as UTCTimestamp,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
      }))
    );
  }, [klines]); // eslint-disable-line react-hooks/exhaustive-deps

  // 推进一根
  const stepForward = useCallback(() => {
    if (!klines) return;
    setIdx((cur) => {
      if (cur >= klines.length) {
        setPlaying(false);
        return cur;
      }
      const bar = klines[cur];
      seriesRef.current?.update({
        time: bar.time as UTCTimestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      });
      if (guessMode) {
        setGuess((g) => {
          if (g.pending === null) return g;
          const wentUp = bar.close >= bar.open;
          const pickedUp = g.pending === "up";
          const right = wentUp === pickedUp;
          const streak = right ? g.streak + 1 : 0;
          const best = Math.max(g.best, streak);
          saveReplayBest(best);
          return {
            ...g,
            streak,
            best,
            correct: g.correct + (right ? 1 : 0),
            total: g.total + 1,
            pending: null,
            lastFeedback: `${wentUp ? dict.feedbackUp : dict.feedbackDown} · ${
              right ? "✅" : "❌"
            }`,
          };
        });
      }
      return cur + 1;
    });
  }, [klines, guessMode, dict]);

  // 播放定时器（guess 模式下需先预测才推进）
  useEffect(() => {
    if (!playing || !klines) return;
    if (idx >= klines.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlaying(false);
      return;
    }
    if (guessMode && guess.pending === null) {
       
      setPlaying(false);
      return;
    }
    const t = setTimeout(stepForward, 1000 / speed);
    return () => clearTimeout(t);
  }, [playing, idx, speed, klines, guessMode, guess.pending, stepForward]);

  function pick(direction: "up" | "down") {
    if (!guessMode || !klines || idx >= klines.length) return;
    setGuess((g) => ({ ...g, pending: direction }));
    setTimeout(() => stepForward(), 350); // 短暂停顿后揭晓
  }

  const finished = !!klines && idx >= klines.length;

  return (
    <div>
      {/* 控制条 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1.5 font-mono text-xs outline-none focus:border-accent"
        >
          {SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {SYMBOL_NAMES[s] ?? s} ({s})
            </option>
          ))}
        </select>
        <select
          value={interval_}
          onChange={(e) => setInterval_(e.target.value)}
          className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1.5 font-mono text-xs outline-none focus:border-accent"
        >
          {INTERVALS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <button
          onClick={() => setRound((r) => r + 1)}
          className="px-3 py-1.5 rounded-lg text-xs border border-accent/40 bg-accent-dim text-accent hover:bg-accent hover:text-white dark:hover:text-[#06281c] transition"
        >
          {dict.newRound}
        </button>
        <button
          onClick={() => setGuessMode((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs border transition ${
            guessMode
              ? "border-accent/60 bg-accent-dim text-accent"
              : "border-[var(--border)] text-muted hover:text-foreground"
          }`}
        >
          {guessMode ? dict.modeGuess : dict.modeFree}
        </button>
        <span className="ml-auto font-mono text-xs text-faint">
          {dict.rounds}: {klines ? `${Math.max(idx - CONTEXT, 0)}/${klines.length - CONTEXT}` : "-"}
        </span>
      </div>

      {/* 图表 */}
      <div className="relative rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] overflow-hidden">
        <div ref={containerRef} className="h-[380px] sm:h-[420px]" />
        {!klines && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-faint">
            …
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            Binance API unreachable
          </div>
        )}
      </div>

      {/* 操作区 */}
      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        {guessMode ? (
          <div className="space-y-4">
            {guess.lastFeedback && (
              <p className="text-sm font-mono text-accent">{guess.lastFeedback}</p>
            )}
            {finished ? (
              <div className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-dim)] p-5 text-center">
                <p className="text-sm text-faint">{dict.summaryTitle}</p>
                <p className="mt-2 font-mono text-4xl font-bold text-accent">
                  {gradeOf(guess.total, guess.correct)}
                </p>
                <p className="mt-3 text-sm text-muted">
                  {guess.correct}/{guess.total} · {dict.accuracy}:{" "}
                  {guess.total > 0
                    ? Math.round((guess.correct / guess.total) * 100)
                    : 0}
                  % · {dict.streak} {guess.streak} · {dict.best} {guess.best}
                </p>
                <button
                  onClick={() => setRound((r) => r + 1)}
                  className="mt-4 rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2 transition"
                >
                  {dict.newRound}
                </button>
              </div>
            ) : guess.pending === null ? (
              <>
                <p className="font-medium">{dict.guessPrompt}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => pick("up")}
                    aria-label={dict.up}
                    aria-pressed={guess.pending === "up"}
                    className="flex-1 rounded-xl border border-accent/50 bg-accent-dim text-accent font-semibold py-3 hover:bg-accent hover:text-white dark:hover:text-[#06281c] transition"
                  >
                    {dict.up}
                  </button>
                  <button
                    onClick={() => pick("down")}
                    aria-label={dict.down}
                    aria-pressed={guess.pending === "down"}
                    className="flex-1 rounded-xl border border-down/50 bg-down/10 text-down font-semibold py-3 hover:bg-down hover:text-white transition"
                  >
                    {dict.down}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-faint animate-pulse">
                {dict.youGot}: {guess.pending === "up" ? dict.up : dict.down}
              </p>
            )}
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                [dict.streak, guess.streak],
                [dict.best, guess.best],
                [
                  dict.accuracy,
                  guess.total > 0
                    ? `${Math.round((guess.correct / guess.total) * 100)}%`
                    : "-",
                ],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-lg font-bold font-mono text-accent">
                    {value as string | number}
                  </p>
                  <p className="text-xs text-faint">{label as string}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setPlaying((v) => !v)}
              disabled={!klines || finished}
              className="rounded-full bg-accent-strong hover:bg-accent disabled:opacity-40 text-white dark:text-[#06281c] font-semibold px-6 py-2.5 transition"
            >
              {playing ? dict.pause : dict.play}
            </button>
            <button
              onClick={stepForward}
              disabled={!klines || finished}
              className="rounded-full border border-border-strong px-5 py-2.5 text-sm font-medium disabled:opacity-40 hover:border-accent/60 transition"
            >
              {dict.step}
            </button>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs text-faint mr-1">{dict.speed}</span>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2.5 py-1.5 rounded-lg font-mono text-xs transition ${
                    s === speed
                      ? "bg-accent-dim text-accent border border-accent/40"
                      : "border border-[var(--border)] text-muted hover:text-foreground"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-faint">{dict.contextNote}</p>
      </div>
      <p className="mt-3 text-xs text-faint">{dict.disclaimer}</p>
    </div>
  );
}
