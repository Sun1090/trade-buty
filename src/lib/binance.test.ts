import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchKlines, fetchRandomHistoryWindow, InvalidMarketSymbolError } from "./binance";

type FetchFn = (url: string, init?: RequestInit) => Promise<unknown>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const RAW = [
  [1700000000000, "1.5", "2.0", "1.0", "1.8", "100.5", 1700003600000],
];

describe("fetchKlines", () => {
  /**
   * 这里的 `- 8 * 3600` 是**位移量**，不是「换成北京时间」：lightweight-charts 只用
   * `getUTC*` 画刻度，所以减完的坐标在轴上读出来比 UTC 还慢 8 小时（口径之争记 R16.47）。
   * 写死数字是有意的——改 `DISPLAY_TZ_OFFSET_SEC` 必须同时过这里。
   */
  it("把币安原始数组解析为 Kline，并按展示位移往前挪 8 小时", async () => {
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

  it("400 且 code 为 -1121 时判成「交易对不存在」，不是普通的请求失败", async () => {
    // 实测：`NOTAREALPAIR` 与只有合约市场的 `1000PEPEUSDT` 都是 HTTP 400 + 这个 code
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ code: -1121, msg: "Invalid symbol." }),
    })));
    await expect(fetchKlines("1000PEPEUSDT", "1h")).rejects.toBeInstanceOf(InvalidMarketSymbolError);
  });

  it("400 但 code 不是 -1121 时不越权下结论，仍按请求失败报状态码", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ code: -1120, msg: "Invalid interval." }),
    })));
    await expect(fetchKlines("BTCUSDT", "2h")).rejects.toThrow(/行情请求失败 \(400\)/);
  });

  it("400 的回答不是 JSON（反代给的 HTML 页）时读不出码，也按请求失败处理", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 400 })));
    await expect(fetchKlines("BTCUSDT", "1h")).rejects.toThrow(/行情请求失败 \(400\)/);
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

  it("抽样确实是随机的，而不是被钳死在一个端点", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => ({ ok: true, status: 200, json: async () => [] }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.999);
    const ends: number[] = [];
    for (let i = 0; i < 2; i++) {
      await fetchRandomHistoryWindow("BTCUSDT", "1h", 300);
      ends.push(Number(new URL(String(fetchMock.mock.calls[i][0])).searchParams.get("endTime")));
    }
    // 0 与 0.999 之间应当摊开约 173 天；钳位生效过的话这里会塌成同一个点
    expect(ends[1] - ends[0]).toBeGreaterThan(30 * 24 * 3600_000);
  });
});
