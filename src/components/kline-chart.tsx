"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type LineData,
} from "lightweight-charts";
import { fetchKlines } from "@/lib/binance";
import {
  MOBILE_CHART_MAX_WIDTH,
  getChartDataLimit,
  getChartDensityFromViewport,
} from "@/lib/chart-density";
import { shouldUseLowBandwidth } from "@/lib/network-quality";
import { useNetworkQuality } from "@/components/use-network-quality";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"] as const;
const INTERVALS = ["15m", "1h", "4h", "1d"] as const;
type ViewportSnapshot = "server" | "mobile" | "desktop";

function subscribeToViewport(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const media = window.matchMedia(`(max-width: ${MOBILE_CHART_MAX_WIDTH}px)`);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getViewportSnapshot(): ViewportSnapshot {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "server";
  }
  return window.matchMedia(`(max-width: ${MOBILE_CHART_MAX_WIDTH}px)`).matches
    ? "mobile"
    : "desktop";
}

function getServerViewportSnapshot(): ViewportSnapshot {
  return "server";
}

interface ChartDict {
  loading: string;
  error: string;
  retry: string;
  symbolLabel: string;
  intervalLabel: string;
  customSymbolLabel: string;
  customSymbolPlaceholder: string;
  compactNote: string;
  fullNote: string;
  showFull: string;
  showCompact: string;
  slowNetwork: string;
  offline: string;
  timeout: string;
  disclaimer: string;
}

export function KlineChart({ dict }: { dict: ChartDict }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [symbol, setSymbol] = useState<string>("BTCUSDT");
  const [interval_, setInterval_] = useState<string>("1h");
  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "timeout"
  >("loading");
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [showMA, setShowMA] = useState(false);
  const [forceFull, setForceFull] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const networkQuality = useNetworkQuality();
  const viewport = useSyncExternalStore(
    subscribeToViewport,
    getViewportSnapshot,
    getServerViewportSnapshot,
  );
  const viewportReady = viewport !== "server";
  const isNarrowViewport = viewport === "mobile";
  const lowBandwidth = shouldUseLowBandwidth(networkQuality);
  const maRef = useRef<ISeriesApi<"Line"> | null>(null);
  const density = getChartDensityFromViewport(
    isNarrowViewport,
    forceFull && !lowBandwidth,
  );
  const dataLimit = getChartDataLimit(density);
  const displayStatus = networkQuality === "offline" ? "offline" : status;

  useEffect(() => {
    if (!containerRef.current) return;
    const rootStyle = getComputedStyle(document.documentElement);
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: rootStyle.getPropertyValue("--muted").trim() || "#8892a6",
        fontFamily:
          "var(--font-geist-sans), -apple-system, 'PingFang SC', sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(233,237,245,.05)" },
        horzLines: { color: "rgba(233,237,245,.05)" },
      },
      autoSize: true,
      timeScale: { borderColor: "rgba(233,237,245,.12)" },
      rightPriceScale: { borderColor: "rgba(233,237,245,.12)" },
    });
    chartRef.current = chart;
    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#f87171",
      borderVisible: false,
      wickUpColor: "#34d399",
      wickDownColor: "#f87171",
    });
    volumeRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeRef.current.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.applyOptions({
      layout: { fontSize: density === "compact" ? 10 : 12 },
      grid: {
        vertLines: { visible: density !== "compact" },
        horzLines: { visible: density !== "compact" },
      },
      rightPriceScale: { minimumWidth: density === "compact" ? 54 : 0 },
    });
  }, [density]);

  useEffect(() => {
    if (networkQuality === "offline") return;
    if (
      !viewportReady ||
      !candleRef.current ||
      !volumeRef.current ||
      !chartRef.current
    ) {
      return;
    }
    const candle = candleRef.current;
    const volume = volumeRef.current;
    const chart = chartRef.current;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      networkQuality === "slow" ? 20_000 : 12_000,
    );
    async function load() {
      setStatus("loading");
      try {
        const klines = await fetchKlines(symbol, interval_, {
          limit: dataLimit,
          signal: controller.signal,
        });
        if (cancelled) return;
        const candles: CandlestickData<UTCTimestamp>[] = klines.map((k) => ({
          time: k.time as UTCTimestamp,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }));
        candle.setData(candles);
        volume.setData(
          klines.map((k) => ({
            time: k.time as UTCTimestamp,
            value: k.volume,
            color: k.close >= k.open ? "rgba(52,211,153,.4)" : "rgba(248,113,113,.4)",
          }))
        );
        setLastPrice(klines[klines.length - 1]?.close ?? null);
        chart.timeScale().fitContent();

        // MA(7) 移动平均线
        if (showMA && chart) {
          if (!maRef.current) {
            maRef.current = chart.addSeries(LineSeries, {
              color: "rgba(96,165,250,0.7)",
              lineWidth: 1,
            });
          }
          const maData: LineData[] = [];
          for (let i = 6; i < candles.length; i++) {
            const sum = candles.slice(i - 6, i + 1).reduce((s, c) => s + c.close, 0);
            maData.push({ time: candles[i].time, value: sum / 7 });
          }
          maRef.current?.setData(maData);
        }

        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus(controller.signal.aborted ? "timeout" : "error");
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    load();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [
    symbol,
    interval_,
    dataLimit,
    viewportReady,
    networkQuality,
    retryNonce,
  ]);

  // WS 实时更新最后一根 K 线（指数退避重连）
  useEffect(() => {
    if (networkQuality !== "online") return;
    const stream = `${symbol.toLowerCase()}@kline_${interval_}`;
    let ws: WebSocket | null = null;
    let retry = 0;
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      if (closed) return;
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}`);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as {
            k?: Record<string, string | number>;
          };
          const k = msg.k;
          if (!k || !candleRef.current) return;
          const bar = {
            time: (Math.floor(Number(k.t) / 1000) - 8 * 3600) as UTCTimestamp,
            open: Number(k.o),
            high: Number(k.h),
            low: Number(k.l),
            close: Number(k.c),
          };
          candleRef.current.update(bar);
          volumeRef.current?.update({
            time: bar.time,
            value: Number(k.v),
            color:
              bar.close >= bar.open
                ? "rgba(52,211,153,.4)"
                : "rgba(248,113,113,.4)",
          });
          setLastPrice(bar.close);
        } catch {
          // 单帧异常忽略，不打断连接
        }
      };
      ws.onclose = () => {
        if (closed) return;
        const delay = Math.min(1000 * 2 ** retry++, 30000);
        timer = setTimeout(connect, delay);
      };
    }
    connect();

    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      ws?.close();
      retry = 0;
    };
  }, [symbol, interval_, networkQuality]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={dict.symbolLabel}>
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSymbol(s);
                // 收藏最近使用的币对
                try {
                  const favs = JSON.parse(localStorage.getItem("tb-chart-favs") || "[]");
                  const next = [s, ...favs.filter((f: string) => f !== s)].slice(0, 6);
                  localStorage.setItem("tb-chart-favs", JSON.stringify(next));
                } catch {}
              }}
              aria-label={`${dict.symbolLabel} ${s}`}
              aria-pressed={s === symbol}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs transition ${
                s === symbol
                  ? "bg-accent-dim text-accent border border-accent/40"
                  : "border border-[var(--border)] text-muted hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
          <input
            type="text"
            placeholder={dict.customSymbolPlaceholder}
            aria-label={dict.customSymbolLabel}
            defaultValue={symbol}
            onBlur={(e) => {
              const v = e.target.value.trim().toUpperCase();
              if (v && v !== symbol && /^[A-Z]+USDT$/.test(v)) {
                setSymbol(v);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-24 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-muted text-xs font-mono focus:border-accent transition"
          />
        </div>
          <div className="flex flex-wrap items-center gap-3">
            {lastPrice !== null && (
              <span className="font-mono text-sm text-accent">
                {lastPrice.toLocaleString()}
              </span>
            )}
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={dict.intervalLabel}>
            {INTERVALS.map((i) => (
              <button
                key={i}
                onClick={() => setInterval_(i)}
                aria-label={`${dict.intervalLabel} ${i}`}
                aria-pressed={i === interval_}
                className={`px-2.5 py-1.5 rounded-lg font-mono text-xs transition ${
                  i === interval_
                    ? "bg-accent-dim text-accent border border-accent/40"
                    : "border border-[var(--border)] text-muted hover:text-foreground"
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowMA((v) => !v)}
            aria-pressed={showMA}
            className={`px-2.5 py-1.5 rounded-lg font-mono text-xs transition ${
              showMA
                ? "bg-accent-dim text-accent border border-accent/40"
                : "border border-[var(--border)] text-muted hover:text-foreground"
            }`}
            title="MA(7)"
          >
            MA7
          </button>
        </div>
      </div>
      <div
        data-testid="kline-chart"
        data-density={density}
        data-network-quality={networkQuality}
        className="relative rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] overflow-hidden"
        role="img"
        aria-label={`${symbol} chart`}
      >
        <div ref={containerRef} className={density === "compact" ? "h-[300px]" : "h-[420px]"} />
        {displayStatus === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-faint">
            {dict.loading}
          </div>
        )}
        {displayStatus === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted">
            <p>{dict.error}</p>
            <button
              onClick={() => setRetryNonce((value) => value + 1)}
              className="text-accent underline underline-offset-4"
            >
              {dict.retry}
            </button>
          </div>
        )}
        {displayStatus === "timeout" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted">
            <p>{dict.timeout}</p>
            <button
              onClick={() => setRetryNonce((value) => value + 1)}
              className="min-h-10 text-accent underline underline-offset-4"
            >
              {dict.retry}
            </button>
          </div>
        )}
        {displayStatus === "offline" && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted">
            <p>{dict.offline}</p>
          </div>
        )}
      </div>
      {lowBandwidth && (
        <p
          data-testid="network-quality-note"
          className="mt-2 text-xs leading-relaxed text-faint"
          aria-live="polite"
        >
          {networkQuality === "offline" ? dict.offline : dict.slowNetwork}
        </p>
      )}
      {isNarrowViewport && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
          <p aria-live="polite">{density === "compact" ? dict.compactNote : dict.fullNote}</p>
          {!lowBandwidth && (
            <button
              type="button"
              data-testid="chart-density-toggle"
              onClick={() => setForceFull((value) => !value)}
              className="min-h-10 px-3 text-accent underline underline-offset-4"
            >
              {density === "compact" ? dict.showFull : dict.showCompact}
            </button>
          )}
        </div>
      )}
      <p className="mt-3 text-xs text-faint">{dict.disclaimer}</p>
    </div>
  );
}
