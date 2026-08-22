/** 币安公开行情 REST 助手（客户端可用，无需 API Key） */

export interface Kline {
  time: number; // UTC 秒
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const INTERVAL_MS: Record<string, number> = {
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

export async function fetchKlines(
  symbol: string,
  interval: string,
  opts?: { endTime?: number; limit?: number }
): Promise<Kline[]> {
  const params = new URLSearchParams({
    symbol,
    interval,
    limit: String(opts?.limit ?? 500),
  });
  if (opts?.endTime) params.set("endTime", String(opts.endTime));
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?${params.toString()}`
  );
  if (!res.ok) throw new Error(`行情请求失败 (${res.status})`);
  const raw = (await res.json()) as unknown[][];
  return raw.map((k) => ({
    // 对齐到 UTC+8 展示习惯
    time: (Math.floor(Number(k[0]) / 1000) - 8 * 3600) as number,
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }));
}

/** 随机选取一个过去的历史窗口（避免偷看当前价格），返回该窗口的 K 线 */
export async function fetchRandomHistoryWindow(
  symbol: string,
  interval: string,
  count = 300
): Promise<Kline[]> {
  const stepMs = INTERVAL_MS[interval] ?? 60 * 60_000;
  const windowMs = count * stepMs;
  // 距今 7 天 ~ 180 天前的任意窗口
  const maxEnd = Date.now() - 7 * 24 * 3600_000;
  const minEnd = Math.max(windowMs + stepMs, Date.now() - 180 * 24 * 3600_000);
  const endTime = Math.floor(
    minEnd + Math.random() * Math.max(maxEnd - minEnd, 1)
  );
  return fetchKlines(symbol, interval, { endTime, limit: count });
}
