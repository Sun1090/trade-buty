"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"] as const;
const INTERVALS = ["15m", "1h", "4h", "1d"] as const;

interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchKlines(symbol: string, interval: string): Promise<Kline[]> {
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=500`
  );
  if (!res.ok) throw new Error(`行情请求失败 (${res.status})`);
  const raw = (await res.json()) as unknown[][];
  return raw.map((k) => ({
    // 币安开盘时间 ms → 秒；对齐到 UTC 避免时区偏移
    time: (Math.floor(Number(k[0]) / 1000) - 8 * 3600) as UTCTimestamp,
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }));
}

export function KlineChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [symbol, setSymbol] = useState<string>("BTCUSDT");
  const [interval_, setInterval_] = useState<string>("1h");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [lastPrice, setLastPrice] = useState<number | null>(null);

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
    let cancelled = false;
    async function load() {
      if (!candleRef.current || !volumeRef.current) return;
      setStatus("loading");
      try {
        const klines = await fetchKlines(symbol, interval_);
        if (cancelled) return;
        const candles: CandlestickData<UTCTimestamp>[] = klines.map((k) => ({
          time: k.time as UTCTimestamp,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }));
        candleRef.current.setData(candles);
        volumeRef.current.setData(
          klines.map((k) => ({
            time: k.time as UTCTimestamp,
            value: k.volume,
            color: k.close >= k.open ? "rgba(52,211,153,.4)" : "rgba(248,113,113,.4)",
          }))
        );
        setLastPrice(klines[klines.length - 1]?.close ?? null);
        chartRef.current?.timeScale().fitContent();
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [symbol, interval_]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-1.5">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs transition ${
                s === symbol
                  ? "bg-accent-dim text-accent border border-accent/40"
                  : "border border-[var(--border)] text-muted hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {lastPrice !== null && (
            <span className="font-mono text-sm text-accent">
              {lastPrice.toLocaleString()}
            </span>
          )}
          <div className="flex gap-1.5">
            {INTERVALS.map((i) => (
              <button
                key={i}
                onClick={() => setInterval_(i)}
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
        </div>
      </div>
      <div className="relative rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] overflow-hidden">
        <div ref={containerRef} className="h-[420px]" />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-faint">
            加载行情中…
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted">
            <p>行情加载失败，币安 API 可能不可达</p>
            <button
              onClick={() => setInterval_((v) => v)}
              className="text-accent underline underline-offset-4"
            >
              重试
            </button>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-faint">
        ⚠️ 行情数据来自币安公开 API，仅用于学习研究，不构成任何投资建议。
      </p>
    </div>
  );
}
