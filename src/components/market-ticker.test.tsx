// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

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
});
