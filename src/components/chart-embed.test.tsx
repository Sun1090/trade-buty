// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

type ChartProps = { dict: Record<string, string> };

const h = vi.hoisted(() => ({
  callback: null as IntersectionObserverCallback | null,
  disconnect: vi.fn(),
}));

function ChartStub(props: ChartProps) {
  return (
    <div
      data-testid="kline-stub"
      data-dict={JSON.stringify(props.dict)}
    />
  );
}

vi.mock("next/dynamic", () => ({ default: () => ChartStub }));

class FakeIntersectionObserver {
  root = null;
  rootMargin = "";
  thresholds: number[] = [];
  constructor(callback: IntersectionObserverCallback) {
    h.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {
    h.disconnect();
    h.callback = null;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

import { LazyChartEmbed, type ChartEmbedDict } from "./chart-embed";

const dict: ChartEmbedDict = {
  heading: "K 线图",
  loading: "加载中",
  error: "出错了",
  retry: "重试",
  symbolLabel: "交易对",
  intervalLabel: "周期",
  customSymbolLabel: "自定义",
  customSymbolPlaceholder: "BTCUSDT",
  compactNote: "紧凑模式",
  fullNote: "完整模式",
  showFull: "展开",
  showCompact: "收起",
  slowNetwork: "网络较慢",
  offline: "离线",
  timeout: "超时",
  disclaimer: "风险提示",
};

beforeEach(() => {
  h.callback = null;
  h.disconnect.mockClear();
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function intersect() {
  act(() => {
    h.callback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  });
}

describe("LazyChartEmbed", () => {
  it("renders the heading and a placeholder before entering the viewport", () => {
    render(<LazyChartEmbed dict={dict} />);
    expect(screen.getByText(/K 线图/)).toBeInTheDocument();
    expect(screen.queryByTestId("kline-stub")).toBeNull();
  });

  it("mounts the chart once the container intersects", () => {
    render(<LazyChartEmbed dict={dict} />);
    intersect();
    expect(screen.getByTestId("kline-stub")).toBeInTheDocument();
    // 命中后立即 disconnect，effect 清理会再 disconnect 一次（幂等）
    expect(h.disconnect).toHaveBeenCalled();
    expect(h.callback).toBeNull();
  });

  it("passes the chart dictionary without the section heading", () => {
    render(<LazyChartEmbed dict={dict} />);
    intersect();
    const passed = JSON.parse(
      screen.getByTestId("kline-stub").getAttribute("data-dict") ?? "{}",
    ) as Record<string, string>;
    expect(passed.loading).toBe("加载中");
    expect(passed.disclaimer).toBe("风险提示");
    expect(passed.heading).toBeUndefined();
  });

  it("ignores non-intersecting entries", () => {
    render(<LazyChartEmbed dict={dict} />);
    act(() => {
      h.callback?.(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(screen.queryByTestId("kline-stub")).toBeNull();
    expect(h.disconnect).not.toHaveBeenCalled();
  });
});
