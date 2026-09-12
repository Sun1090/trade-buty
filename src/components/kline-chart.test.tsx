// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { KlineChart } from "./kline-chart";

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
  return { chart, candleSeries, lineSeries, CandlestickSeries, HistogramSeries, LineSeries, createChart, fetchKlines };
});

vi.mock("lightweight-charts", () => ({
  createChart: mocks.createChart,
  CandlestickSeries: mocks.CandlestickSeries,
  HistogramSeries: mocks.HistogramSeries,
  LineSeries: mocks.LineSeries,
}));

vi.mock("@/lib/binance", () => ({ fetchKlines: mocks.fetchKlines }));

vi.mock("@/components/use-network-quality", () => ({
  useNetworkQuality: () => "online",
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

describe("KlineChart MA(7) 开关（回归：关闭必须移除 series）", () => {
  beforeEach(() => {
    mocks.chart.addSeries.mockClear();
    mocks.chart.removeSeries.mockClear();
    mocks.lineSeries.setData.mockClear();
    mocks.fetchKlines.mockReset();
    mocks.fetchKlines.mockImplementation(async () => klines);
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

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
