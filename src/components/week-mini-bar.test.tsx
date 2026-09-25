// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { localDateStr, shiftDate } from "@/lib/date-utils";

let dates: string[] = [];
vi.mock("@/lib/activity-calendar", () => ({
  readActivityDates: () => dates,
}));

import { WeekMiniBar } from "./week-mini-bar";

beforeEach(() => {
  dates = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WeekMiniBar", () => {
  it("渲染 7 个柱（近 7 天）", () => {
    const { container } = render(<WeekMiniBar locale="zh" />);
    const labels = container.querySelectorAll("span");
    expect(labels.length).toBe(7);
  });

  it("中文 locale 使用中文星期标签", () => {
    const { container } = render(<WeekMiniBar locale="zh" />);
    const text = Array.from(container.querySelectorAll("span")).map((s) => s.textContent);
    for (const t of text) expect(["日", "一", "二", "三", "四", "五", "六"]).toContain(t);
  });

  it("英文 locale 使用英文星期标签", () => {
    const { container } = render(<WeekMiniBar locale="en" />);
    const text = Array.from(container.querySelectorAll("span")).map((s) => s.textContent);
    for (const t of text) {
      expect(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]).toContain(t);
    }
  });

  it("挂载后读到活动日期：今天亮起并写进无障碍名称", () => {
    dates = [localDateStr()];
    const { container } = render(<WeekMiniBar locale="zh" />);
    const bars = container.querySelectorAll("[data-active]");
    expect(bars.length).toBe(7);
    // 最后一根是「今天」
    expect(bars[6].getAttribute("data-active")).toBe("true");
    expect(bars[0].getAttribute("data-active")).toBe("false");
    expect(container.querySelector("[role='img']")).toHaveAttribute(
      "aria-label",
      "近 7 天里哪几天记过一次学习活动（标过已读、答过题或打完一轮回放；从 6 天前到今天）：无、无、无、无、无、无、有",
    );
  });

  // role="img" 会把容器内文字降级成装饰，所以名称必须自带完整 7 格模式，
  // 只报「哪几天有」会让听的人不知道窗口从哪天开始。
  it("没有活动记录时两个语言都报出 7 格全空，而不是空标签", () => {
    const { container } = render(<WeekMiniBar locale="zh" />);
    expect(container.querySelector("[role='img']")).toHaveAttribute(
      "aria-label",
      "近 7 天里哪几天记过一次学习活动（标过已读、答过题或打完一轮回放；从 6 天前到今天）：无、无、无、无、无、无、无",
    );
    const { container: en } = render(<WeekMiniBar locale="en" />);
    expect(en.querySelector("[role='img']")).toHaveAttribute(
      "aria-label",
      "Which of the last 7 days recorded a learning activity (a lesson marked read, a question answered, or a replay round finished; oldest to newest): no, no, no, no, no, no, no",
    );
  });

  // 记录学习时 streak 模块会派发 tb-streak，活动日期也在那里写入；
  // 同一页的热力图跟着亮，这根条以前 memo 在 [locale] 上所以不会。
  it("已挂载的条随 tb-streak 更新，不需要重新渲染", () => {
    const { container } = render(<WeekMiniBar locale="zh" />);
    expect(container.querySelectorAll('[data-active="true"]').length).toBe(0);

    dates = [localDateStr(), shiftDate(localDateStr(), -3)];
    act(() => {
      window.dispatchEvent(new Event("tb-streak"));
    });

    const bars = container.querySelectorAll("[data-active]");
    expect(bars[6].getAttribute("data-active")).toBe("true");
    expect(bars[3].getAttribute("data-active")).toBe("true");
    expect(container.querySelectorAll('[data-active="true"]').length).toBe(2);
  });
});
