"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { fetchKlines, fetchRandomHistoryWindow, sampleHistoryWindowEndMs, type Kline } from "@/lib/binance";
import { saveReplayRecord, saveReplayBest } from "@/lib/replay-store";
import { addStudyTime } from "@/lib/study-time";
import { localDateStr, localDayEndMs } from "@/lib/date-utils";
import { measureFps, LOW_END_FPS_THRESHOLD, REPLAY_REDUCED_CANDLES } from "@/lib/perf";
import { ReplayShareCard } from "@/components/replay-share-card";
import { gradeFromReplayAccuracy } from "@/lib/share-card";
import { encodeReplay } from "@/lib/share-decode";
import { REPLAY_SYMBOLS } from "@/lib/chart-symbols";

const SYMBOL_NAMES: Record<string, string> = {
  BTCUSDT: "Bitcoin",
  ETHUSDT: "Ethereum",
  BNBUSDT: "BNB",
  SOLUSDT: "Solana",
};
const INTERVALS = ["15m", "1h", "4h", "1d"] as const;
/** 倍速档位；播放步进的真实间隔由它算出（见下面的 setTimeout），测试要盯同一个来源 */
export const SPEEDS = [1, 2, 4] as const;
const DIFFICULTIES = [
  { labelKey: "difficultyNew", context: 50 },
  { labelKey: "difficultyIntermediate", context: 30 },
  { labelKey: "difficultyChallenge", context: 15 },
] as const;

export interface ReplayDict {
  newRound: string;
  play: string;
  pause: string;
  step: string;
  speed: string;
  symbolLabel: string;
  intervalLabel: string;
  difficultyLabel: string;
  difficultyNew: string;
  difficultyIntermediate: string;
  difficultyChallenge: string;
  skipToEnd: string;
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
  shortHistory: string;
  shortHistoryCustom: string;
  shortHistoryBlind: string;
  disclaimer: string;
  modeBlind: string;
  modeCustom: string;
  endDateLabel: string;
  startCustom: string;
  shareReplay: string;
  previewReplay: string;
  fetchError: string;
  download: string;
  previewAlt: string;
  copyLink: string;
  copiedLink: string;
  copyFailed: string;
  downloadFailed: string;
  previewFailed: string;
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

/**
 * 一轮的起点。`best` 是**这一轮**的最佳连胜——屏幕上那块「本轮总结」念的就是它，
 * 历史最佳另有存放处（`tb-replay-best`，由 `saveReplayBest` 单调维护）。
 */
const EMPTY_ROUND: GuessState = {
  streak: 0,
  best: 0,
  correct: 0,
  total: 0,
  pending: null,
  lastFeedback: null,
};

/**
 * 读取记忆的难度下标。
 * 该值来自 localStorage，可能被用户手改、被旧版本写入（档数不同）或被截断——
 * 任何非法值都回退到默认「进阶」，不让坏数据把整个训练器打崩。
 */
function initialDifficultyIdx(): number {
  const DEFAULT_IDX = 1;
  try {
    const saved = localStorage.getItem("tb-replay-difficulty");
    if (!saved) return DEFAULT_IDX;
    const n = Number.parseInt(saved, 10);
    return Number.isInteger(n) && n >= 0 && n < DIFFICULTIES.length ? n : DEFAULT_IDX;
  } catch {
    return DEFAULT_IDX;
  }
}

function gradeLabel(total: number, correct: number): string {
  if (total === 0) return "-";
  // 评级口径只有 `gradeFromReplayAccuracy` 一份实现：同一块面板里的分享卡用的就是它，
  // 它规定少于 3 次猜测样本不足、不给好评。这里曾经另写一份没有该守卫的规则，
  // 于是 2/2 的一轮在面板上是 S、画到卡上是 C。
  return gradeFromReplayAccuracy(correct / total, total);
}


export function ReplayTrainer({ dict, locale }: { dict: ReplayDict; locale: "zh" | "en" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // R8.4 分享链接 URL（client-only）——origin 在 hydration 后才稳定
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrigin(window.location.origin);
    }
  }, []);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [symbol, setSymbol] = useState<string>(REPLAY_SYMBOLS[0]);
  const [interval_, setInterval_] = useState<string>("1h");
  const [round, setRound] = useState(0);
  // R4.2：本轮回放开始时刻（round 变化即新一轮），结束时上报耗时
  const roundStartRef = useRef<number>(0);
  useEffect(() => {
    roundStartRef.current = Date.now();
  }, [round]);
  const [customMode, setCustomMode] = useState(false);
  // 日界一律按本地日历取：UTC 口径会把 UTC+8 用户每天前 8 小时判成昨天，
  // 日期选择器于是禁止选择今天。
  const [endDateInput, setEndDateInput] = useState(() =>
    localDateStr(new Date(Date.now() - 30 * 86400_000)),
  );
  const [customEnd, setCustomEnd] = useState<number | null>(null);
  // R7.3：低端机降级——帧率不达标时减少可见 K 线密度
  const [lowEnd, setLowEnd] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void measureFps(1500).then((fps) => {
      if (!cancelled && fps > 0 && fps < LOW_END_FPS_THRESHOLD) setLowEnd(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [klines, setKlines] = useState<Kline[] | null>(null);
  const [difficultyIdx, setDifficultyIdx] = useState(initialDifficultyIdx);
  // 记忆难度选择
  useEffect(() => {
    try { localStorage.setItem("tb-replay-difficulty", String(difficultyIdx)); } catch { }
  }, [difficultyIdx]);
  // 下标已由 initialDifficultyIdx 收敛，这里再兜一层，避免任何未来入口绕过校验
  const context = (DIFFICULTIES[difficultyIdx] ?? DIFFICULTIES[1]).context;
  /**
   * 这一轮真正能回放的根数。自定义结束时间落在标的上市之前时，币安回的是
   * HTTP 200 + `[]`（实测），长度可以小于 context，原先 `klines.length - context`
   * 直接把「已回放」的分母写成负数。
   */
  const availableRounds = klines ? Math.max(klines.length - context, 0) : 0;
  const [idx, setIdx] = useState<number>(context);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [guessMode, setGuessMode] = useState(false);
  const [guess, setGuess] = useState<GuessState>(EMPTY_ROUND);
  const [error, setError] = useState(false);
  // 哨兵必须是 round 永远取不到的值：round 从 0 起，用 0 会让「第 0 轮」永远
  // 命中 savedRoundRef.current !== round 为假，导致首轮战绩被静默丢弃。
  const savedRoundRef = useRef(-1);

  useEffect(() => {
    if (
      guessMode &&
      klines &&
      idx >= klines.length &&
      guess.total > 0 &&
      savedRoundRef.current !== round
    ) {
      savedRoundRef.current = round;
      const elapsed = roundStartRef.current > 0
        ? Math.min(Math.round((Date.now() - roundStartRef.current) / 1000), 8 * 3600)
        : 0;
      if (elapsed > 0) addStudyTime("replay", elapsed);
      roundStartRef.current = Date.now();
      // R12.5：记录本轮耗时（秒），供回放练习时长统计；无起点计时不伪造
      saveReplayRecord({
        symbol,
        interval: interval_,
        total: guess.total,
        correct: guess.correct,
        bestStreak: guess.best,
        ...(elapsed > 0 ? { durationSec: elapsed } : {}),
      });
    }
  }, [guessMode, klines, idx, guess.total, guess.correct, guess.best, round, symbol, interval_]);

  // 载入这一轮的 K 线：盲盒模式抽随机历史窗口，自定义模式锚定在 customEnd 那一天之前
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(false);
     
    setPlaying(false);
    const loader =
      customMode && customEnd
        ? fetchKlines(symbol, interval_, { endTime: customEnd, limit: 300 })
        : fetchRandomHistoryWindow(symbol, interval_);
    loader
      .then((data) => {
        if (cancelled) return;
        setKlines(data);
        setIdx(context);
        setGuess(EMPTY_ROUND);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, interval_, round, customMode, customEnd, context]);

  /**
   * 起一轮新的回放。**必须**与 `setRound` 在同一个动作里把上一轮的战绩清掉：
   * 入库那道效应（上面那条 `useEffect`）的依赖里有 `round`，而 `klines` 要等这个
   * 效应触发的取数回来才换、`idx` 还停在上一轮末尾——只 bump `round` 的话，
   * `savedRoundRef.current !== round` 重新成立，刚结束那轮会被原样再记一条
   * （那条的 `elapsed` 是刚重置的计时，四舍五入成 0 所以不带 `durationSec`），
   * 并且 `savedRoundRef` 被抬到新轮号，用户真打完的那一轮反而一条都不记。
   * 顺序也不能反：清空要发生在 `setRound` 之前，否则同一次 commit 里门槛仍然成立。
   */
  const beginRound = () => {
    setGuess(EMPTY_ROUND);
    setRound((r) => r + 1);
  };

  // 「新一轮」：只 bump round 在自定义模式里等于**重发同一个请求**——取数用的是同一个
  // customEnd，回来的还是刚才那 300 根，用户重放的是同一段行情，而这一轮照样会被记进训练记录。
  // 所以自定义模式下先往前另抽一段，并把「截止日期」跟着挪到那一段真正结束的那天：
  // 那一格说的是屏幕上这段 K 线结束于哪天，不是用户上一次手输的值。
  const startNewRound = () => {
    if (customMode && customEnd) {
      const nextEnd = sampleHistoryWindowEndMs(customEnd);
      setCustomEnd(nextEnd);
      setEndDateInput(localDateStr(new Date(nextEnd)));
    }
    beginRound();
  };

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

  /**
   * 全量把序列填到第 `to` 根。数据变化与「跳到回放末尾」必须走同一条路径：
   * 播放推进用的是逐根 `update()`，所以跳过整段时如果只改下标，图表会停在原处，
   * 而上面的价格与「已回放 N/N」已经说到末尾了。
   */
  const fillSeriesTo = useCallback((to: number) => {
    if (!klines || !seriesRef.current) return;
    // R7.3：全量填图时低端机只截取最近 REPLAY_REDUCED_CANDLES 根，降低 Canvas 负载。
    // 这条上限是"填图时裁"，不是"屏上永远只有 N 根"——逐根推进走的是下面的 update()，
    // 不会回头裁剪，所以播放过程中序列可以长过 N。
    const view = lowEnd ? klines.slice(0, to).slice(-REPLAY_REDUCED_CANDLES) : klines.slice(0, to);
    seriesRef.current.setData(
      view.map((k) => ({
        time: k.time as UTCTimestamp,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
      }))
    );
  }, [klines, lowEnd]);

  // 数据变化 → 全量重设。idx 不进依赖：逐根推进由 stepForward 的 update() 负责
  useEffect(() => {
    fillSeriesTo(idx);
  }, [klines, lowEnd]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // 页面隐藏时自动暂停
  useEffect(() => {
    function onVis() {
      if (document.hidden && playing) setPlaying(false);
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [playing]);

  return (
    <div>
      {/* 控制条 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          aria-label={dict.symbolLabel}
          className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1.5 font-mono text-xs focus:border-accent"
        >
          {REPLAY_SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {SYMBOL_NAMES[s] ?? s} ({s})
            </option>
          ))}
        </select>
        <select
          value={interval_}
          onChange={(e) => setInterval_(e.target.value)}
          aria-label={dict.intervalLabel}
          className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1.5 font-mono text-xs focus:border-accent"
        >
          {INTERVALS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <div
          role="group"
          aria-label={dict.difficultyLabel}
          className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] p-0.5"
        >
          {DIFFICULTIES.map((d, i) => (
            <button
              key={d.labelKey}
              onClick={() => setDifficultyIdx(i)}
              aria-pressed={i === difficultyIdx}
              className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                i === difficultyIdx
                  ? "bg-[var(--accent-dim)] text-accent"
                  : "text-faint hover:text-foreground"
              }`}
            >
              {dict[d.labelKey]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] p-0.5">
          {[
            { on: !customMode, label: dict.modeBlind, set: () => setCustomMode(false) },
            { on: customMode, label: dict.modeCustom, set: () => setCustomMode(true) },
          ].map((m) => (
            <button
              key={m.label}
              onClick={m.set}
              aria-pressed={m.on}
              className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                m.on
                  ? "bg-[var(--accent-dim)] text-accent"
                  : "text-faint hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {customMode && (
          <>
            <label className="flex items-center gap-1.5 text-[11px] text-faint">
              {dict.endDateLabel}
              <input
                type="date"
                value={endDateInput}
                max={localDateStr()}
                onChange={(e) => setEndDateInput(e.target.value)}
                className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 font-mono text-xs text-foreground focus:border-accent [color-scheme:dark]"
              />
            </label>
            <button
              onClick={() => {
                // 输入是本地日历日，上界就该落在该本地日结束时；按 UTC 午夜换算会砍掉当天尾部
                const ms = localDayEndMs(endDateInput);
                if (!Number.isNaN(ms)) {
                  setCustomEnd(ms);
                  beginRound();
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs border border-accent/40 bg-accent-dim text-accent hover:bg-accent hover:text-white dark:hover:text-[#06281c] transition"
            >
              {dict.startCustom}
            </button>
          </>
        )}
        <button
          onClick={startNewRound}
          className="px-3 py-1.5 rounded-lg text-xs border border-accent/40 bg-accent-dim text-accent hover:bg-accent hover:text-white dark:hover:text-[#06281c] transition"
        >
          {dict.newRound}
        </button>
        <button
          onClick={() => setGuessMode((v) => !v)}
          aria-pressed={guessMode}
          className={`px-3 py-1.5 rounded-lg text-xs border transition ${
            guessMode
              ? "border-accent/60 bg-accent-dim text-accent"
              : "border-[var(--border)] text-muted hover:text-foreground"
          }`}
        >
          {/* 名字只报它切的那个模式，开没开由 aria-pressed 和高亮说：
              原先关了以后钮上写的是「自由观看」，而页面 intro 让用户去开「猜涨跌」，
              第一次访客在这一排里找不到 intro 点名的那个开关。 */}
          {dict.modeGuess}
        </button>
        <span className="ml-auto font-mono text-xs text-faint flex items-center gap-3">
          {klines && idx > 0 && klines[idx - 1] && (
            <span className="text-accent">
              {Number(klines[idx - 1].close).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          )}
          {dict.rounds}: {klines ? `${Math.max(Math.min(idx - context, availableRounds), 0)}/${availableRounds}` : "-"}
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
            {dict.fetchError}
          </div>
        )}
        {klines && !error && availableRounds === 0 && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted">
            {dict.shortHistory
              .replace("{n}", String(klines.length))
              .replace("{m}", String(context + 1))}
            {/* R16.193：建议只能指着屏幕上真的有的控件。截止输入框只在「自定义」下渲染
                （`customMode && …`），盲盒的结束时间是抽出来的，用户没有任何东西可调。 */}
            {customMode
              ? dict.shortHistoryCustom.replace("{end}", dict.endDateLabel)
              : dict.shortHistoryBlind.replace("{mode}", dict.modeCustom)}
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
                  {gradeLabel(guess.total, guess.correct)}
                </p>
                <p className="mt-3 text-sm text-muted">
                  {guess.correct}/{guess.total} · {dict.accuracy}:{" "}
                  {guess.total > 0
                    ? Math.round((guess.correct / guess.total) * 100)
                    : 0}
                  % · {dict.streak} {guess.streak} · {dict.best} {guess.best}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <button
                    onClick={startNewRound}
                    className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2 transition"
                  >
                    {dict.newRound}
                  </button>
                  {/* R8.2 回放战绩分享卡 */}
                  <ReplayShareCard
                    symbol={symbol}
                    interval={interval_}
                    correct={guess.correct}
                    total={guess.total}
                    accuracy={guess.total > 0 ? guess.correct / guess.total : 0}
                    bestStreak={guess.best}
                    currentStreak={guess.streak}
                    locale={locale}
                    labels={{
                      share: dict.shareReplay,
                      preview: dict.previewReplay,
                      previewAlt: dict.previewAlt,
                      download: dict.download,
                      copyLink: dict.copyLink,
                      copiedLink: dict.copiedLink,
                      copyFailed: dict.copyFailed,
                  downloadFailed: dict.downloadFailed,
                  previewFailed: dict.previewFailed,
                    }}
                    shareUrl={
                      !origin || guess.total <= 0
                        ? undefined
                        : `${origin}/share/replay/${encodeReplay({
                            symbol,
                            interval: interval_,
                            correct: guess.correct,
                            total: guess.total,
                            accuracyBps: Math.round(
                              guess.total > 0 ? (guess.correct / guess.total) * 10000 : 0,
                            ),
                            bestStreak: guess.best,
                            currentStreak: guess.streak,
                            locale,
                          })}`
                    }
                  />
                </div>
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
              aria-pressed={playing}
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
            <button
              onClick={() => {
                if (!klines) return;
                fillSeriesTo(klines.length);
                setIdx(klines.length);
              }}
              disabled={!klines || finished}
              aria-label={dict.skipToEnd}
              className="rounded-full border border-border-strong px-5 py-2.5 text-sm font-medium disabled:opacity-40 hover:border-accent/60 transition"
              title={dict.skipToEnd}
            >
              ⏭
            </button>
            <div role="group" aria-label={dict.speed} className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs text-faint mr-1">{dict.speed}</span>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  aria-pressed={s === speed}
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
        <p className="mt-3 text-xs text-faint">
          {dict.contextNote.replace("{n}", String(context)).replace("{m}", String(context + 1))}
        </p>
      </div>
      <p className="mt-3 text-xs text-faint">{dict.disclaimer}</p>
    </div>
  );
}
