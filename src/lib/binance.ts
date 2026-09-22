/** 币安公开行情 REST 助手（客户端可用，无需 API Key） */

export interface Kline {
  time: number; // UTC 秒
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchKlines(
  symbol: string,
  interval: string,
  opts?: { endTime?: number; limit?: number; signal?: AbortSignal }
): Promise<Kline[]> {
  const params = new URLSearchParams({
    symbol,
    interval,
    limit: String(opts?.limit ?? 500),
  });
  if (opts?.endTime) params.set("endTime", String(opts.endTime));
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?${params.toString()}`,
    { signal: opts?.signal },
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
  // 距今 7 天 ~ 180 天前的任意窗口。
  // 这里曾有一行 `Math.max(count * stepMs, Date.now() - 180d)` 想保证「窗口不越过有记录的最早
  // 时间」，但 `count * stepMs` 是**时长**（约 2.6e10），拿去和**绝对时间戳**（约 1.8e12）取
  // max 永远输给对方，所以它从未生效过；标的历史不够长时币安本就返回较少根数，由调用方自行处理。
  const maxEnd = Date.now() - 7 * 24 * 3600_000;
  const minEnd = Date.now() - 180 * 24 * 3600_000;
  const endTime = Math.floor(
    minEnd + Math.random() * Math.max(maxEnd - minEnd, 1)
  );
  return fetchKlines(symbol, interval, { endTime, limit: count });
}
