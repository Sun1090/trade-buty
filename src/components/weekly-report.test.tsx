// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});

const { WeeklyReport } = await import("./weekly-report");
const { addStudyTime, getTotalStudySeconds, getStudySeconds } = await import("@/lib/study-time");
const { localDateStr } = await import("@/lib/date-utils");

beforeEach(() => store.clear());
afterEach(cleanup);

const dict = { title: "近 7 天学习", unit: "分钟", summaryTpl: "近 7 天共学 {n} 分钟，日均 {avg} 分钟" };

describe("WeeklyReport（R4.6/R4.11/R4.12）", () => {
  it("渲染 7 根柱子与文字摘要（读屏可读）", async () => {
    const today = localDateStr();
    addStudyTime("read", 15 * 60, today);
    render(<WeeklyReport dict={dict} />);
    // 摘要文字
    expect(await screen.findByText("近 7 天共学 15 分钟，日均 2 分钟")).toBeInTheDocument();
    // aria-label 同步
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("共学 15 分钟");
    // 7 个柱列
    expect(document.querySelectorAll(".flex-1.min-w-0").length).toBe(7);
  });

  it("tb-study-time 事件后柱状刷新", async () => {
    const today = localDateStr();
    render(<WeeklyReport dict={dict} />);
    expect(await screen.findByText("近 7 天共学 0 分钟，日均 0 分钟")).toBeInTheDocument();
    addStudyTime("quiz", 10 * 60, today);
    fireEvent(window, new Event("tb-study-time"));
    expect(await screen.findByText("近 7 天共学 10 分钟，日均 1 分钟")).toBeInTheDocument();
  });
});

describe("口径对账（R4.10）", () => {
  it("getTotalStudySeconds = Σ各日去重 total（而非三源简单相加）", () => {
    addStudyTime("read", 600, "2026-09-04");
    addStudyTime("quiz", 100, "2026-09-05");
    addStudyTime("replay", 100, "2026-09-05");
    addStudyTime("read", 500, "2026-09-05");
    // 09-04: 600；09-05: max(500, 200)=500 → 合计 1100（不是 1300）
    expect(getTotalStudySeconds()).toBe(1100);
    expect(getStudySeconds("2026-09-05").total).toBe(500);
  });
});
