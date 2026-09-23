// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { KlineChart } from "./kline-chart";
import { getDict } from "@/lib/i18n";
import { COMPACT_CHART_CANDLES, FULL_CHART_CANDLES } from "@/lib/chart-density";

// lightweight-charts 在 jsdom 下没有 canvas，用探针替身接管 series 生命周期。
const mocks = vi.hoisted(() => {
  const candleSeries = {
    setData: vi.fn(),
    update: vi.fn(),
    priceScale: () => ({ applyOptions: vi.fn() }),
  };
  const volumeSeries = {
    setData: vi.fn(),
    update: vi.fn(),
    priceScale: () => ({ applyOptions: vi.fn() }),
  };
  const lineSeries = {
    setData: vi.fn(),
    update: vi.fn(),
    priceScale: () => ({ applyOptions: vi.fn() }),
  };
  const chart = {
    addSeries: vi.fn((kind: unknown) => {
      if (kind === CandlestickSeries) return candleSeries;
      if (kind === HistogramSeries) return volumeSeries;
      return lineSeries;
    }),
    removeSeries: vi.fn(),
    applyOptions: vi.fn(),
    remove: vi.fn(),
    timeScale: () => ({ fitContent: vi.fn() }),
  };
  // 占位哨兵：仅用于 addSeries 分派，不需要真实图表行为
  const CandlestickSeries = { __kind: "candlestick" };
  const HistogramSeries = { __kind: "histogram" };
  const LineSeries = { __kind: "line" };
  const createChart = vi.fn(() => chart);
  const fetchKlines = vi.fn();
  return {
    chart,
    candleSeries,
    volumeSeries,
    lineSeries,
    CandlestickSeries,
    HistogramSeries,
    LineSeries,
    createChart,
    fetchKlines,
    networkQuality: "online" as "online" | "slow" | "offline",
    matchMobile: false,
  };
});

vi.mock("lightweight-charts", () => ({
  createChart: mocks.createChart,
  CandlestickSeries: mocks.CandlestickSeries,
  HistogramSeries: mocks.HistogramSeries,
  LineSeries: mocks.LineSeries,
}));

// 只桩掉网络取数，横轴口径常量必须用真值：换成本地字面量的话，改常量也测不出来
vi.mock("@/lib/binance", async () => {
  const actual = await vi.importActual<typeof import("@/lib/binance")>("@/lib/binance");
  return { ...actual, fetchKlines: mocks.fetchKlines };
});

vi.mock("@/components/use-network-quality", () => ({
  useNetworkQuality: () => mocks.networkQuality,
}));

const dict = {
  loading: "加载中",
  error: "行情加载失败",
  retry: "重试",
  symbolLabel: "交易对",
  intervalLabel: "周期",
  customSymbolLabel: "自定义交易对",
  customSymbolPlaceholder: "如 DOGEUSDT",
  compactNote: "紧凑模式",
  fullNote: "完整模式",
  showFull: "显示完整",
  showCompact: "显示紧凑",
  slowNetwork: "网络较慢",
  offline: "离线",
  timeout: "请求超时",
  disclaimer: "行情仅供参考",
};

const klines = Array.from({ length: 40 }, (_, i) => ({
  time: 1_700_000_000 + i * 3600,
  open: 100 + i,
  high: 102 + i,
  low: 99 + i,
  close: 101 + i,
  volume: 10 + i,
}));

function installMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  close = vi.fn();
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
}

const realWebSocket = globalThis.WebSocket;

beforeEach(() => {
  mocks.chart.addSeries.mockClear();
  mocks.chart.removeSeries.mockClear();
  mocks.chart.applyOptions.mockClear();
  mocks.chart.remove.mockClear();
  mocks.candleSeries.setData.mockClear();
  mocks.candleSeries.update.mockClear();
  mocks.lineSeries.setData.mockClear();
  mocks.fetchKlines.mockReset();
  mocks.fetchKlines.mockImplementation(async () => klines);
  mocks.networkQuality = "online";
  mocks.matchMobile = false;
  installMatchMedia(false);
  MockWebSocket.instances = [];
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  localStorage.clear();
});

afterEach(() => {
  globalThis.WebSocket = realWebSocket;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("KlineChart MA(7) 开关（回归：关闭必须移除 series）", () => {
  it("默认不创建 MA series", async () => {
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    expect(mocks.chart.addSeries).not.toHaveBeenCalledWith(
      mocks.LineSeries,
      expect.anything(),
    );
  });

  it("打开时新增 LineSeries 并写入 MA 数据，关闭时移除该 series", async () => {
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "MA7" }));
    await waitFor(() =>
      expect(mocks.chart.addSeries).toHaveBeenCalledWith(
        mocks.LineSeries,
        expect.anything(),
      ),
    );
    // 40 根 K 线 → 34 个 MA(7) 点（前 6 根没有足够窗口）
    await waitFor(() => expect(mocks.lineSeries.setData).toHaveBeenCalled());
    expect(mocks.lineSeries.setData.mock.lastCall?.[0]).toHaveLength(34);

    fireEvent.click(screen.getByRole("button", { name: "MA7" }));
    await waitFor(() =>
      expect(mocks.chart.removeSeries).toHaveBeenCalledWith(mocks.lineSeries),
    );
  });
});

describe("KlineChart 加载失败与重试", () => {
  it("拉取失败展示错误文案，点击重试后恢复", async () => {
    mocks.fetchKlines.mockRejectedValueOnce(new Error("boom"));
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(screen.getByText("行情加载失败")).toBeInTheDocument());
    expect(screen.getByText("重试")).toBeInTheDocument();

    fireEvent.click(screen.getByText("重试"));
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    expect(screen.queryByText("行情加载失败")).toBeNull();
  });

  it("请求超时（AbortController 触发）展示超时文案", async () => {
    vi.useFakeTimers();
    mocks.fetchKlines.mockImplementation(
      (_symbol: string, _interval: string, opts: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    render(<KlineChart dict={dict} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(screen.getByText("请求超时")).toBeInTheDocument();
  });

  it("超时态的重试按钮重新拉取", async () => {
    vi.useFakeTimers();
    mocks.fetchKlines.mockImplementation(
      (_symbol: string, _interval: string, opts: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    render(<KlineChart dict={dict} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(screen.getByText("请求超时")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("重试"));
    });
    expect(mocks.fetchKlines).toHaveBeenCalledTimes(2);
    expect(screen.getByText("加载中")).toBeInTheDocument();
  });

  it("请求返回前卸载不再写入图表", async () => {
    let resolveFetch: (value: typeof klines) => void = () => {};
    mocks.fetchKlines.mockImplementation(
      () => new Promise((res) => { resolveFetch = res; }),
    );
    const { unmount } = render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.fetchKlines).toHaveBeenCalled());
    unmount();
    await act(async () => {
      resolveFetch(klines);
    });
    expect(mocks.candleSeries.setData).not.toHaveBeenCalled();
  });

  it("空 K 线响应不设置最新价", async () => {
    mocks.fetchKlines.mockResolvedValueOnce([]);
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    expect(mocks.candleSeries.setData).toHaveBeenCalledWith([]);
    // 无 lastPrice：不应渲染价格文本
    expect(screen.queryByText(/^[\d,]+$/)).toBeNull();
  });

  it("下跌 K 线使用红色量柱", async () => {
    const down = [{ ...klines[0], open: 120, close: 100, high: 121, low: 99 }];
    mocks.fetchKlines.mockResolvedValueOnce(down);
    render(<KlineChart dict={dict} />);
    await waitFor(() =>
      expect(mocks.volumeSeries.setData).toHaveBeenCalledWith([
        expect.objectContaining({ color: "rgba(248,113,113,.4)" }),
      ]),
    );
  });

  it("已开启 MA 时切换周期复用同一个 series", async () => {
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "MA7" }));
    await waitFor(() => expect(mocks.lineSeries.setData).toHaveBeenCalled());
    const addCalls = mocks.chart.addSeries.mock.calls.filter(
      (c) => c[0] === mocks.LineSeries,
    ).length;

    fireEvent.click(screen.getByRole("button", { name: "周期 4h" }));
    await waitFor(() =>
      expect(mocks.fetchKlines).toHaveBeenCalledWith(
        "BTCUSDT",
        "4h",
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(
        mocks.chart.addSeries.mock.calls.filter(
          (c) => c[0] === mocks.LineSeries,
        ).length,
      ).toBe(addCalls),
    );
  });

  it("展示最新收盘价", async () => {
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    const last = klines[klines.length - 1].close;
    expect(screen.getByText(last.toLocaleString())).toBeInTheDocument();
  });
});

describe("KlineChart 网络质量分支", () => {
  it("离线时不发起请求并展示离线态", async () => {
    mocks.networkQuality = "offline";
    render(<KlineChart dict={dict} />);
    await waitFor(() =>
      expect(screen.getByTestId("kline-chart")).toHaveAttribute(
        "data-network-quality",
        "offline",
      ),
    );
    expect(mocks.fetchKlines).not.toHaveBeenCalled();
    // 覆盖层与网络提示各显示一次「离线」
    expect(screen.getAllByText("离线")).toHaveLength(2);
    expect(screen.getByTestId("network-quality-note")).toHaveTextContent("离线");
  });

  it("慢网展示提示并进入低带宽模式", async () => {
    mocks.networkQuality = "slow";
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    expect(screen.getByTestId("network-quality-note")).toHaveTextContent("网络较慢");
    expect(screen.getByTestId("kline-chart")).toHaveAttribute(
      "data-network-quality",
      "slow",
    );
    // 桌面宽度下不显示密度切换
    expect(screen.queryByTestId("chart-density-toggle")).toBeNull();
  });

  /**
   * 低带宽只改两件事：暂停实时推送、不给「切到完整视图」的入口。根数由视口决定
   * （density 只看 viewport），所以桌面慢网仍按完整视图取数。那句提示曾经写死
   * 「已切换为 180 根 K 线精简模式」——在桌面宽度下是一句假话。
   */
  it("慢网提示不承诺它没做的降根数（桌面宽度仍按完整视图取数）", async () => {
    mocks.networkQuality = "slow";
    const zh = { ...dict, slowNetwork: getDict("zh").chart.slowNetwork };
    const { unmount } = render(<KlineChart dict={zh} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    const note = screen.getByTestId("network-quality-note").textContent ?? "";
    expect(note).toContain("网络较慢");
    expect(note, "根数由视口决定，低带宽不改").not.toMatch(/\d+\s*根/);
    expect(mocks.fetchKlines).toHaveBeenCalledWith(
      "BTCUSDT",
      "1h",
      expect.objectContaining({ limit: FULL_CHART_CANDLES }),
    );
    unmount();

    const en = { ...dict, slowNetwork: getDict("en").chart.slowNetwork };
    render(<KlineChart dict={en} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    const enNote = screen.getByTestId("network-quality-note").textContent ?? "";
    expect(enNote.toLowerCase()).toContain("slow network");
    expect(enNote, "en 同样不能声称切到 180 根").not.toMatch(/\d+[- ]candle/);
  });

  it("在线切换为离线后展示离线态", async () => {
    const { rerender } = render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    mocks.networkQuality = "offline";
    rerender(<KlineChart dict={dict} />);
    expect(screen.getByTestId("kline-chart")).toHaveAttribute(
      "data-network-quality",
      "offline",
    );
    expect(screen.getAllByText("离线").length).toBeGreaterThan(0);
  });
});

describe("KlineChart 视口降级", () => {
  it("不支持 matchMedia 时按服务端快照处理且不拉取", async () => {
    (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
    render(<KlineChart dict={dict} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.fetchKlines).not.toHaveBeenCalled();
    expect(screen.getByText("加载中")).toBeInTheDocument();
  });

  it("服务端渲染使用 server 快照", () => {
    installMatchMedia(false);
    const html = renderToString(<KlineChart dict={dict} />);
    expect(html).toContain("行情仅供参考");
    expect(mocks.fetchKlines).not.toHaveBeenCalled();
  });
});

describe("KlineChart 移动端密度", () => {
  beforeEach(() => {
    mocks.matchMobile = true;
    installMatchMedia(true);
  });

  it("窄屏默认紧凑模式，可用切换按钮进入完整模式", async () => {
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    expect(screen.getByTestId("kline-chart")).toHaveAttribute("data-density", "compact");
    expect(mocks.fetchKlines).toHaveBeenCalledWith(
      "BTCUSDT",
      "1h",
      expect.objectContaining({ limit: 180 }),
    );

    const toggle = screen.getByTestId("chart-density-toggle");
    expect(toggle).toHaveTextContent("显示完整");
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(screen.getByTestId("kline-chart")).toHaveAttribute("data-density", "full"),
    );
    expect(screen.getByTestId("chart-density-toggle")).toHaveTextContent("显示紧凑");
    await waitFor(() =>
      expect(mocks.fetchKlines).toHaveBeenCalledWith(
        "BTCUSDT",
        "1h",
        expect.objectContaining({ limit: 500 }),
      ),
    );
  });

  // 视图说明里的根数必须就是这次取数用的那个数：写死文字与 chart-density 常量
  // 各说一套，就会重演 slowNetwork 那句假话。
  it("精简/完整视图说明的根数等于实际取数上限", async () => {
    mocks.matchMobile = true;
    installMatchMedia(true);
    for (const locale of ["zh", "en"] as const) {
      const labels = getDict(locale).chart;
      expect(labels.compactNote, `${locale} 的紧凑说明要留占位符`).toContain("{n}");
      expect(labels.fullNote, `${locale} 的完整说明要留占位符`).toContain("{n}");
      mocks.fetchKlines.mockClear();
      const { unmount } = render(
        <KlineChart dict={{ ...dict, compactNote: labels.compactNote, fullNote: labels.fullNote }} />,
      );
      await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
      const note = screen.getByText(/根 K 线|candles/).textContent ?? "";
      expect(note).not.toContain("{n}");
      expect(mocks.fetchKlines).toHaveBeenCalledWith(
        "BTCUSDT",
        "1h",
        expect.objectContaining({ limit: COMPACT_CHART_CANDLES }),
      );
      expect(note, `窄屏说明的根数要等于取数上限（${locale}）`).toContain(String(COMPACT_CHART_CANDLES));
      unmount();
    }
  });

  it("低带宽下隐藏密度切换按钮", async () => {
    mocks.networkQuality = "slow";
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    expect(screen.queryByTestId("chart-density-toggle")).toBeNull();
    expect(screen.getByText("紧凑模式")).toBeInTheDocument();
  });
});

describe("KlineChart 交易对与周期切换", () => {
  it("点击币种按钮切换交易对并写入收藏", async () => {
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "交易对 ETHUSDT" }));
    await waitFor(() =>
      expect(mocks.fetchKlines).toHaveBeenCalledWith(
        "ETHUSDT",
        "1h",
        expect.anything(),
      ),
    );
    expect(JSON.parse(localStorage.getItem("tb-chart-favs") || "[]")).toEqual([
      "ETHUSDT",
    ]);
  });

  it("自定义交易对输入合法时切换", async () => {
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    const input = screen.getByLabelText("自定义交易对");
    fireEvent.change(input, { target: { value: "dogeusdt" } });
    fireEvent.blur(input);
    await waitFor(() =>
      expect(mocks.fetchKlines).toHaveBeenCalledWith(
        "DOGEUSDT",
        "1h",
        expect.anything(),
      ),
    );
  });

  it("自定义交易对非法时不切换", async () => {
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    const input = screen.getByLabelText("自定义交易对");
    fireEvent.change(input, { target: { value: "DOGE" } });
    fireEvent.blur(input);
    expect(mocks.fetchKlines).toHaveBeenCalledTimes(1);
    expect(mocks.fetchKlines).toHaveBeenCalledWith(
      "BTCUSDT",
      "1h",
      expect.anything(),
    );
  });

  it("自定义交易对回车触发失焦提交", async () => {
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    const input = screen.getByLabelText("自定义交易对");
    fireEvent.change(input, { target: { value: "SOLUSDT" } });
    input.focus();
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    await waitFor(() =>
      expect(mocks.fetchKlines).toHaveBeenCalledWith(
        "SOLUSDT",
        "1h",
        expect.anything(),
      ),
    );
  });

  it("非回车按键不提交自定义交易对", async () => {
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    const input = screen.getByLabelText("自定义交易对");
    fireEvent.change(input, { target: { value: "SOLUSDT" } });
    fireEvent.keyDown(input, { key: "a" });
    expect(mocks.fetchKlines).toHaveBeenCalledTimes(1);
  });

  it("换标的后输入框显示的就是图上的那一个", async () => {
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    const typed = screen.getByLabelText("自定义交易对");
    fireEvent.change(typed, { target: { value: "xrpusdt" } });
    fireEvent.blur(typed);
    await waitFor(() =>
      expect(mocks.fetchKlines).toHaveBeenCalledWith("XRPUSDT", "1h", expect.anything()),
    );
    fireEvent.click(screen.getByRole("button", { name: "交易对 ETHUSDT" }));
    await waitFor(() =>
      expect(mocks.fetchKlines).toHaveBeenCalledWith("ETHUSDT", "1h", expect.anything()),
    );
    // 输入框是非受控的：没有 key 重挂载就会停留在上一个手输的 XRPUSDT
    expect(screen.getByLabelText("自定义交易对")).toHaveValue("ETHUSDT");
  });

  it("切换周期会重新拉取", async () => {
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "周期 4h" }));
    await waitFor(() =>
      expect(mocks.fetchKlines).toHaveBeenCalledWith(
        "BTCUSDT",
        "4h",
        expect.anything(),
      ),
    );
  });
});

describe("KlineChart 实时 WebSocket 更新", () => {
  it("建立连接并按推送更新最后一根 K 线", async () => {
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    expect(MockWebSocket.instances[0].url).toBe(
      "wss://stream.binance.com:9443/ws/btcusdt@kline_1h",
    );
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());

    act(() => {
      MockWebSocket.instances[0].onmessage?.({
        data: JSON.stringify({
          k: { t: "1700000000000", o: "1", h: "2", l: "0.5", c: "1.5", v: "42" },
        }),
      });
    });
    expect(mocks.candleSeries.update).toHaveBeenCalledWith(
      // 与 REST 侧同一个字面量：两条路口径一旦错开，实时帧就不再覆盖最后一根，而是另起一根
      expect.objectContaining({
        time: 1_700_000_000 - 8 * 3600,
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
      }),
    );
    expect(screen.getByText("1.5")).toBeInTheDocument();
  });

  it("忽略无法解析的推送帧", async () => {
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    act(() => {
      MockWebSocket.instances[0].onmessage?.({ data: "not-json" });
    });
    expect(mocks.candleSeries.update).not.toHaveBeenCalled();
  });

  it("忽略缺少 K 线字段的帧", async () => {
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    act(() => {
      MockWebSocket.instances[0].onmessage?.({ data: JSON.stringify({}) });
    });
    expect(mocks.candleSeries.update).not.toHaveBeenCalled();
  });

  it("下跌推送帧使用红色量柱", async () => {
    render(<KlineChart dict={dict} />);
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    act(() => {
      MockWebSocket.instances[0].onmessage?.({
        data: JSON.stringify({
          k: { t: "1700000000000", o: "10", h: "11", l: "8", c: "9", v: "7" },
        }),
      });
    });
    expect(mocks.volumeSeries.update).toHaveBeenCalledWith(
      expect.objectContaining({ color: "rgba(248,113,113,.4)" }),
    );
  });

  it("卸载后触发的关闭回调不再重连", async () => {
    const { unmount } = render(<KlineChart dict={dict} />);
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    const ws = MockWebSocket.instances[0];
    unmount();
    act(() => {
      ws.onclose?.();
    });
    expect(MockWebSocket.instances.length).toBe(1);
  });

  it("连接关闭后按退避重连", async () => {
    vi.useFakeTimers();
    render(<KlineChart dict={dict} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(MockWebSocket.instances.length).toBe(1);
    act(() => {
      MockWebSocket.instances[0].onclose?.();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(MockWebSocket.instances.length).toBe(2);
  });

  it("卸载时关闭连接", async () => {
    const { unmount } = render(<KlineChart dict={dict} />);
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    const ws = MockWebSocket.instances[0];
    unmount();
    expect(ws.close).toHaveBeenCalled();
  });

  it("离线时不建立 WebSocket", async () => {
    mocks.networkQuality = "offline";
    render(<KlineChart dict={dict} />);
    await waitFor(() =>
      expect(screen.getByTestId("kline-chart")).toHaveAttribute(
        "data-network-quality",
        "offline",
      ),
    );
    expect(MockWebSocket.instances.length).toBe(0);
  });

  // 慢网提示写着「恢复后自动继续」，这条就是钉住那半句：网络回到 online 时不用刷新页面。
  it("慢网不建立实时连接，网络恢复后自动重连", async () => {
    mocks.networkQuality = "slow";
    const { rerender } = render(<KlineChart dict={dict} />);
    await waitFor(() => expect(mocks.candleSeries.setData).toHaveBeenCalled());
    expect(MockWebSocket.instances.length).toBe(0);

    act(() => {
      mocks.networkQuality = "online";
    });
    rerender(<KlineChart dict={dict} />);
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
  });
});
