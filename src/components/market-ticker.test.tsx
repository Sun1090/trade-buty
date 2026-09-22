// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";

let quality: "online" | "slow" | "offline" = "online";
vi.mock("@/components/use-network-quality", () => ({
  useNetworkQuality: () => quality,
}));

import { MarketTicker } from "./market-ticker";

beforeEach(() => {
  quality = "online";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const DATA = [
  { symbol: "BTCUSDT", lastPrice: "60000.5", priceChangePercent: "1.23" },
  { symbol: "ETHUSDT", lastPrice: "3000", priceChangePercent: "-2.50" },
  { symbol: "SOLUSDT", lastPrice: "150", priceChangePercent: "0.00" },
];

describe("MarketTicker（R13.11/R13.12）", () => {
  it("成功时渲染三条价格（去掉 USDT 后缀）", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => DATA })));
    render(<MarketTicker />);
    await waitFor(() => expect(screen.getByText("BTC")).toBeInTheDocument());
    expect(screen.getByText("ETH")).toBeInTheDocument();
    expect(screen.getByText("SOL")).toBeInTheDocument();
    expect(screen.getByText("▲ 1.23%")).toBeInTheDocument();
    expect(screen.getByText("▼ -2.50%")).toBeInTheDocument();
  });

  it("离线时暂停轮询，不发起请求并给出提示", async () => {
    quality = "offline";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<MarketTicker />);
    await waitFor(() =>
      expect(screen.getByTestId("market-network-note")).toHaveTextContent("当前离线"),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("market-ticker")).toHaveAttribute(
      "data-network-quality",
      "offline",
    );
  });

  it("慢速网络显示慢速提示且仍会请求", async () => {
    quality = "slow";
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => DATA }));
    vi.stubGlobal("fetch", fetchMock);
    render(<MarketTicker />);
    await waitFor(() =>
      expect(screen.getByTestId("market-network-note")).toHaveTextContent("慢速模式"),
    );
    expect(fetchMock).toHaveBeenCalled();
  });

  it("请求失败显示错误与重试，点击重试重新拉取", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<MarketTicker />);
    await waitFor(() =>
      expect(screen.getByText("行情暂时不可用")).toBeInTheDocument(),
    );
    const calls = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByText("重试"));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(calls));
  });

  it("响应不是数组时按失败处理", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    render(<MarketTicker />);
    await waitFor(() =>
      expect(screen.getByText("行情暂时不可用")).toBeInTheDocument(),
    );
  });

  it("英文 locale 使用英文文案", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => DATA })));
    render(<MarketTicker locale="en" />);
    await waitFor(() => expect(screen.getByText("BTC")).toBeInTheDocument());
    expect(screen.getByText(/Live market · 3 assets/)).toBeInTheDocument();
  });

  // 比「离线」更常见的破网姿势是 onLine 仍为 true 而请求全失败（PR #139 的同一教训）：
  // 此时屏幕上的价格已经不再刷新，却还顶着「实时行情」的标题继续显示。
  it("拿到数据后轮询失败：旧价格标注为上次数据并说明原因，恢复后撤掉标注", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => DATA })
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValue({ ok: true, json: async () => DATA });
      vi.stubGlobal("fetch", fetchMock);
      render(<MarketTicker />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByText("BTC")).toBeInTheDocument();
      expect(screen.queryByText("上次数据")).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
      expect(screen.getByText("BTC")).toBeInTheDocument();
      expect(screen.getByText("上次数据")).toBeInTheDocument();
      expect(screen.getByText("行情暂时不可用")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
      expect(screen.queryByText("上次数据")).not.toBeInTheDocument();
      expect(screen.queryByText("行情暂时不可用")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
