// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ReplayHistory } from "./replay-history";
import type { ReplayRecord } from "@/lib/replay-store";
import { REPLAY_HISTORY_KEEP } from "@/lib/replay-history-limit";

// 可控的 store 桩：组件每次渲染/收到 tb-progress 事件都会回读
const { store } = vi.hoisted(() => ({
  store: { history: [] as unknown[], best: 0 },
}));

vi.mock("@/lib/replay-store", () => ({
  readReplayHistory: () => store.history,
  readReplayBest: () => store.best,
}));
vi.mock("@/components/use-local-progress", () => ({
  useLocalProgress: () => null,
}));

const dict = {
  histTitle: "训练记录",
  histRounds: "轮",
  histAccuracy: "准确率",
  histEmpty: "还没有训练记录",
  histRecent: "最近",
  histBest: "最佳",
  histScopeTpl: "只统计最近 {n} 轮",
};

function rec(over: Partial<ReplayRecord> & { at: number }): ReplayRecord {
  return {
    symbol: "BTCUSDT",
    interval: "1h",
    total: 4,
    correct: 2,
    bestStreak: 2,
    ...over,
  };
}

beforeEach(() => {
  store.history = [];
  store.best = 0;
});
afterEach(() => {
  store.history = [];
  store.best = 0;
});

describe("ReplayHistory", () => {
  it("空历史显示空态", () => {
    render(<ReplayHistory dict={dict} />);
    expect(screen.getByText("还没有训练记录")).toBeInTheDocument();
    expect(screen.queryByText("训练记录")).toBeNull();
  });

  it("汇总轮数、整体准确率与最佳连击", () => {
    store.history = [
      rec({ at: 1_000, total: 4, correct: 1 }),
      rec({ at: 2_000, total: 10, correct: 7 }),
    ];
    store.best = 5;
    render(<ReplayHistory dict={dict} />);

    expect(screen.getByText("训练记录")).toBeInTheDocument();
    expect(screen.getByText("轮")).toBeInTheDocument();
    // 轮数 2；整体 8/14 = 57%；最佳 5
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("57%")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("脚注里的轮数上限由 REPLAY_HISTORY_KEEP 代入，不留花括号", () => {
    store.history = [rec({ at: 1_000, total: 4, correct: 1 })];
    const { container } = render(<ReplayHistory dict={dict} />);
    expect(screen.getByText(`只统计最近 ${REPLAY_HISTORY_KEEP} 轮`)).toBeInTheDocument();
    expect(container.textContent).not.toContain("{n}");
  });

  it("最近记录按时间倒序展示，准确率 ≥50% 用强调色、<50% 用下跌色", () => {
    store.history = [
      rec({ at: 1_000, symbol: "AAA", total: 4, correct: 1 }),
      rec({ at: 2_000, symbol: "BBB", total: 10, correct: 7 }),
    ];
    const { container } = render(<ReplayHistory dict={dict} />);

    const items = [...container.querySelectorAll("li")];
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("BBB");
    expect(items[1]).toHaveTextContent("AAA");

    expect(items[0].querySelector("span.text-accent")).not.toBeNull();
    expect(items[1].querySelector("span.text-down")).not.toBeNull();
    expect(items[0]).toHaveTextContent("7/10 · 70%");
    expect(items[1]).toHaveTextContent("1/4 · 25%");
  });

  it("单轮 total 为 0 时准确率显示 0% 而不是 NaN", () => {
    store.history = [rec({ at: 1_000, total: 0, correct: 0, bestStreak: 0 })];
    render(<ReplayHistory dict={dict} />);
    expect(screen.getByText("0/0 · 0%")).toBeInTheDocument();
    // 整体也回退到 0%（totalQ 为 0）
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("最多展示最近 10 轮", () => {
    store.history = Array.from({ length: 12 }, (_, i) =>
      rec({ at: 1_000 + i, symbol: `S${i}` }),
    );
    const { container } = render(<ReplayHistory dict={dict} />);
    expect(container.querySelectorAll("li")).toHaveLength(10);
    // 倒序，取的是最后 10 条（S11 … S2）
    expect(container.querySelectorAll("li")[0]).toHaveTextContent("S11");
    expect(container.querySelectorAll("li")[9]).toHaveTextContent("S2");
  });

  it("收到 tb-progress 事件后实时刷新（无需重新挂载）", () => {
    render(<ReplayHistory dict={dict} />);
    expect(screen.getByText("还没有训练记录")).toBeInTheDocument();

    act(() => {
      store.history = [rec({ at: 1_000, total: 2, correct: 2 })];
      store.best = 2;
      window.dispatchEvent(new Event("tb-progress"));
    });

    expect(screen.queryByText("还没有训练记录")).toBeNull();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("卸载后移除 tb-progress 监听，避免泄漏", () => {
    const { unmount } = render(<ReplayHistory dict={dict} />);
    const remove = vi.spyOn(window, "removeEventListener");
    unmount();
    expect(remove).toHaveBeenCalledWith("tb-progress", expect.any(Function));
    remove.mockRestore();
  });
});
