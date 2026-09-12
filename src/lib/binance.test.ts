import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchKlines, fetchRandomHistoryWindow } from "./binance";

type FetchFn = (url: string, init?: RequestInit) => Promise<unknown>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const RAW = [
  [1700000000000, "1.5", "2.0", "1.0", "1.8", "100.5", 1700003600000],
];

describe("fetchKlines", () => {
  it("把币安原始数组解析为 Kline 并对齐 UTC+8（时间 -8h）", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => RAW })));
    const [k] = await fetchKlines("BTCUSDT", "1h");
    expect(k).toEqual({
      time: 1700000000 - 8 * 3600,
      open: 1.5,
      high: 2.0,
      low: 1.0,
      close: 1.8,
      volume: 100.5,
    });
  });

  it("默认 limit=500，指定 endTime 时带上查询参数", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => ({ ok: true, status: 200, json: async () => [] }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchKlines("BTCUSDT", "4h", { endTime: 123456 });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("symbol")).toBe("BTCUSDT");
    expect(url.searchParams.get("interval")).toBe("4h");
    expect(url.searchParams.get("limit")).toBe("500");
    expect(url.searchParams.get("endTime")).toBe("123456");
  });

  it("非 2xx 抛带状态码的错误", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 451 })));
    await expect(fetchKlines("BTCUSDT", "1d")).rejects.toThrow(/行情请求失败 \(451\)/);
  });
});

describe("fetchRandomHistoryWindow", () => {
  it("请求历史窗口：limit=count 且 endTime 落在过去 180 天内", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => ({ ok: true, status: 200, json: async () => [] }));
    vi.stubGlobal("fetch", fetchMock);
    const now = Date.now();
    await fetchRandomHistoryWindow("BTCUSDT", "1h", 300);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("limit")).toBe("300");
    const endTime = Number(url.searchParams.get("endTime"));
    expect(endTime).toBeLessThanOrEqual(now - 7 * 24 * 3600_000);
    expect(endTime).toBeGreaterThan(now - 180 * 24 * 3600_000);
  });
});
