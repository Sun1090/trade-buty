// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

let dates: string[] = [];
vi.mock("@/lib/activity-calendar", () => ({
  readActivityDates: () => dates,
}));

import { WeekMiniBar } from "./week-mini-bar";

beforeEach(() => {
  dates = [];
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
});
