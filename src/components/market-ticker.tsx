"use client";

import { useEffect, useState } from "react";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"] as const;

interface Ticker {
  symbol: string;
  price: string;
  change: string;
  up: boolean;
}

/** 首页行情卡片：Binance 公开 API 拉实时价格，5 秒刷新 */
export function MarketTicker() {
  const [tickers, setTickers] = useState<Ticker[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchPrices() {
      try {
        const res = await fetch(
          "https://api.binance.com/api/v3/ticker/24hr?symbols=" +
            JSON.stringify([...SYMBOLS]),
        );
        const data = await res.json();
        if (cancelled) return;
        setTickers(
          data.map((d: { symbol: string; lastPrice: string; priceChangePercent: string }) => ({
            symbol: d.symbol.replace("USDT", ""),
            price: parseFloat(d.lastPrice).toLocaleString("en-US", { maximumFractionDigits: 4 }),
            change: d.priceChangePercent,
            up: parseFloat(d.priceChangePercent) >= 0,
          })),
        );
      } catch {
        // 失败静默
      }
    }
    fetchPrices();
    const t = setInterval(fetchPrices, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (!tickers) return null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-faint mb-3">
        实时行情 · {SYMBOLS.length} 币
      </p>
      <div className="grid grid-cols-3 gap-2">
        {tickers.map((t) => (
          <div key={t.symbol} className="rounded-lg bg-[var(--surface-hover)] px-3 py-2">
            <p className="text-xs text-faint font-mono">{t.symbol}</p>
            <p className="mt-0.5 font-mono text-sm font-bold">{t.price}</p>
            <p className={`text-xs font-mono ${t.up ? "text-accent" : "text-down"}`}>
              {t.up ? "▲" : "▼"} {t.change}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}