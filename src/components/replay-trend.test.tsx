// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

let history: Array<{ at: number; total: number; correct: number }> = [];
vi.mock("@/lib/replay-store", () => ({
  readReplayHistory: () => history,
}));

import { ReplayTrend, REPLAY_TREND_MIN_ROUNDS, REPLAY_TREND_POINTS } from "./replay-trend";
import { getDict } from "@/lib/i18n";

beforeEach(() => {
  history = [];
});

describe("ReplayTrend（R12.5）", () => {
  it("少于两轮时显示空状态文案", () => {
    history = [{ at: 1, total: 10, correct: 5 }];
    render(<ReplayTrend label="趋势" emptyLabel="暂无足够数据" scopeLabel="只画最近 {n} 轮" />);
    expect(screen.getByText("暂无足够数据")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("至少两轮时渲染带 aria-label 的折线图", () => {
    history = [
      { at: 1, total: 10, correct: 3 },
      { at: 2, total: 10, correct: 8 },
    ];
    render(<ReplayTrend label="正确率趋势" emptyLabel="空" scopeLabel="只画最近 {n} 轮" />);
    expect(screen.getByRole("img", { name: "正确率趋势" })).toBeInTheDocument();
  });

  it("total 为 0 的记录按 0% 处理而不产生 NaN", () => {
    history = [
      { at: 1, total: 0, correct: 0 },
      { at: 2, total: 4, correct: 4 },
    ];
    render(<ReplayTrend label="趋势" emptyLabel="空" scopeLabel="只画最近 {n} 轮" />);
    const circles = screen.getByRole("img").querySelectorAll("circle");
    expect(circles.length).toBe(2);
  });

  it("折线只取最近 REPLAY_TREND_POINTS 轮，脚注说的就是同一个数", () => {
    history = Array.from({ length: REPLAY_TREND_POINTS + 5 }, (_, i) => ({
      at: i,
      total: 10,
      correct: i % 10,
    }));
    const { container } = render(
      <ReplayTrend label="趋势" emptyLabel="空" scopeLabel="只画最近 {n} 轮" />,
    );
    const circles = screen.getByRole("img").querySelectorAll("circle");
    expect(circles.length).toBe(REPLAY_TREND_POINTS);
    // 脚注里的数必须由同一个常量代入，不留花括号
    expect(screen.getByText(`只画最近 ${REPLAY_TREND_POINTS} 轮`)).toBeInTheDocument();
    expect(container.textContent).not.toContain("{n}");
  });

  it("tb-progress 事件更新趋势，并按 0% 处理 total 为 0 的增量记录", () => {
    history = [
      { at: 1, total: 10, correct: 3 },
      { at: 2, total: 10, correct: 8 },
    ];
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<ReplayTrend label="正确率趋势" emptyLabel="空" scopeLabel="只画最近 {n} 轮" />);
    expect(addEventListenerSpy).toHaveBeenCalledWith("tb-progress", expect.any(Function));
    history = [
      { at: 3, total: 0, correct: 0 },
      { at: 4, total: 10, correct: 9 },
    ];

    fireEvent(window, new Event("tb-progress"));

    const circles = screen.getByRole("img").querySelectorAll("circle");
    expect(circles.length).toBe(2);
    expect(circles[0].querySelector("title")?.textContent).toContain("0%");
    expect(circles[1].querySelector("title")?.textContent).toContain("90%");
    expect(circles[0].getAttribute("fill")).toBe("var(--down)");
    expect(circles[1].getAttribute("fill")).toBe("var(--accent)");

    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith("tb-progress", expect.any(Function));
  });

  it("数据点的悬浮说明写的是那一轮的本地日期，不是「N 轮前」，也不含中日韩文字", () => {
    history = [
      { at: new Date(2026, 2, 4, 12).getTime(), total: 10, correct: 3 },
      { at: new Date(2026, 2, 5, 12).getTime(), total: 10, correct: 8 },
    ];
    render(<ReplayTrend label="趋势" emptyLabel="空" scopeLabel="只画最近 {n} 轮" />);
    const circles = screen.getByRole("img").querySelectorAll("circle");
    expect(circles[0].querySelector("title")?.textContent).toBe("2026-03-04 · 30%");
    expect(circles[1].querySelector("title")?.textContent).toBe("2026-03-05 · 80%");
    // 中文界面读着没问题，英文界面曾经在这里印出「轮前」
    for (const circle of Array.from(circles)) {
      expect(circle.querySelector("title")?.textContent).not.toMatch(
        /[㐀-鿿぀-ヿ]/
      );
    }
  });

  it("趋势块的空态是另一句：门槛数字由常量填进来，屏上不留占位符", () => {
    history = [{ at: 1, total: 10, correct: 5 }]; // 只有一轮：训练记录卡已经在列，趋势仍是空态
    const { container } = render(
      <ReplayTrend
        label="趋势"
        emptyLabel={getDict("zh").replay.trendEmpty}
        scopeLabel={getDict("zh").replay.trendScopeTpl}
      />
    );
    const shown = container.querySelector("p")?.textContent ?? "";
    expect(shown).toContain(String(REPLAY_TREND_MIN_ROUNDS));
    expect(shown).not.toContain("{");
    expect(getDict("zh").replay.trendEmpty).not.toBe(getDict("zh").replay.histEmpty);
  });
});
