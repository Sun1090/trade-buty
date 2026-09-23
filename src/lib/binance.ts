/** 币安公开行情 REST 助手（客户端可用，无需 API Key） */

/**
 * 图表横轴的位移常量：REST 与 WS 两条路都把币安的 UTC 秒**减去**这一截
 * （`fetchKlines` 与 `kline-chart.tsx` 的 WebSocket 分支各用一次）。
 *
 * 但这个位移换不来任何时区的读数。lightweight-charts 5.2.1 格式化刻度只用 `getUTC*`
 * （翻遍打包产物：`getUTCDate` / `getUTCHours` / `getUTCFullYear` 都在，
 * `getDate` / `getHours` 一个都没有），所以「UTC 秒 − 8h」画到轴上就是**比 UTC 慢 8 小时**
 * ——既不是 UTC，也不是北京时间，也不是访问者的本地时间。站内没有任何文案宣称这张图用哪个
 * 时区，所以屏幕上没有假话，假话只在注释里。选哪个口径是产品决策，记在
 * docs/roadmap.md 的 R16.47；选定之前别改符号、也别照着旧注释以为轴上读的是北京时间。
 *
 * 另外：减完之后 `Kline.time` 只是一个展示坐标，不再等价于真实 epoch，
 * 不能拿去和 `Date.now()` 相减。
 */
export const DISPLAY_TZ_OFFSET_SEC = 8 * 3600;

export interface Kline {
  time: number; // 展示坐标，见 DISPLAY_TZ_OFFSET_SEC
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
    time: Math.floor(Number(k[0]) / 1000) - DISPLAY_TZ_OFFSET_SEC,
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
