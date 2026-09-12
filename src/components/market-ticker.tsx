"use client";

import { useEffect, useState } from "react";
import { getMarketRefreshDelay } from "@/lib/network-quality";
import { useNetworkQuality } from "@/components/use-network-quality";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"] as const;

interface Ticker {
  symbol: string;
  price: string;
  change: string;
  up: boolean;
}

interface MarketTickerDict {
  heading: string;
  loading: string;
  retry: string;
  error: string;
  stale: string;
  offline: string;
  slow: string;
}

const DICT: Record<"zh" | "en", MarketTickerDict> = {
  zh: {
    heading: "实时行情",
    loading: "正在加载行情…",
    retry: "重试",
    error: "行情暂时不可用",
    stale: "上次数据",
    offline: "当前离线：已暂停轮询，恢复联网后自动更新。",
    slow: "慢速模式：每 60 秒更新一次。",
  },
  en: {
    heading: "Live market",
    loading: "Loading market data…",
    retry: "Retry",
    error: "Market data is temporarily unavailable",
    stale: "Last available data",
    offline: "You are offline. Polling is paused and will resume automatically.",
    slow: "Slow mode: refreshing every 60 seconds.",
  },
};

/** 首页行情卡片：Binance 公开 API 拉实时价格；慢网降频，离线暂停。 */
export function MarketTicker({ locale = "zh" }: { locale?: "zh" | "en" }) {
  const dict = DICT[locale];
  const networkQuality = useNetworkQuality();
  const [tickers, setTickers] = useState<Ticker[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (networkQuality === "offline") return;
    const controller = new AbortController();
    let cancelled = false;

    async function fetchPrices() {
      try {
        const res = await fetch(
          "https://api.binance.com/api/v3/ticker/24hr?symbols=" +
            JSON.stringify([...SYMBOLS]),
          { signal: controller.signal, cache: "no-store" },
        );
        if (!res.ok) throw new Error(`market request failed: ${res.status}`);
        const data = (await res.json()) as Array<{
          symbol: string;
          lastPrice: string;
          priceChangePercent: string;
        }>;
        if (!Array.isArray(data)) throw new Error("invalid market response");
        if (cancelled) return;
        setTickers(
          data.map((item) => ({
            symbol: item.symbol.replace("USDT", ""),
            price: parseFloat(item.lastPrice).toLocaleString("en-US", {
              maximumFractionDigits: 4,
            }),
            change: item.priceChangePercent,
            up: parseFloat(item.priceChangePercent) >= 0,
          })),
        );
        setFailed(false);
      } catch (error) {
        if (
          !cancelled &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setFailed(true);
        }
      }
    }

    void fetchPrices();
    const delay = getMarketRefreshDelay(networkQuality);
    const timer = delay === null ? undefined : setInterval(fetchPrices, delay);
    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [networkQuality, retryNonce]);

  const heading = `${dict.heading} · ${SYMBOLS.length} ${locale === "zh" ? "币" : "assets"}`;
  const networkNote =
    networkQuality === "offline"
      ? dict.offline
      : networkQuality === "slow"
        ? dict.slow
        : null;

  return (
    <div
      data-testid="market-ticker"
      data-network-quality={networkQuality}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-faint">
          {heading}
        </p>
        {networkNote && (
          <p
            data-testid="market-network-note"
            className="text-xs text-amber-300"
            aria-live="polite"
          >
            {networkNote}
          </p>
        )}
      </div>

      {!tickers && !failed && (
        <div
          data-testid="market-loading"
          className="grid grid-cols-3 gap-2"
          aria-label={dict.loading}
        >
          {SYMBOLS.map((symbol) => (
            <div
              key={symbol}
              className="h-[72px] animate-pulse rounded-lg bg-[var(--surface-hover)]"
            />
          ))}
        </div>
      )}

      {!tickers && failed && (
        <div className="flex min-h-[72px] flex-col items-center justify-center gap-2 text-sm text-muted">
          <p>{dict.error}</p>
          <button
            type="button"
            onClick={() => setRetryNonce((value) => value + 1)}
            className="min-h-10 px-3 text-accent underline underline-offset-4"
          >
            {dict.retry}
          </button>
        </div>
      )}

      {tickers && (
        <div>
          {networkQuality === "offline" && (
            <p className="mb-2 text-xs text-faint">{dict.stale}</p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {tickers.map((ticker) => (
              <div
                key={ticker.symbol}
                className="rounded-lg bg-[var(--surface-hover)] px-3 py-2"
              >
                <p className="font-mono text-xs text-faint">{ticker.symbol}</p>
                <p className="mt-0.5 font-mono text-sm font-bold">
                  {ticker.price}
                </p>
                <p
                  className={`font-mono text-xs ${ticker.up ? "text-accent" : "text-down"}`}
                >
                  {ticker.up ? "▲" : "▼"} {ticker.change}%
                </p>
              </div>
            ))}
          </div>
          {failed && <p className="mt-2 text-xs text-faint">{dict.error}</p>}
        </div>
      )}
    </div>
  );
}
