// @vitest-environment jsdom
/**
 * R12.24：统计功能无登录降级——guest（无 AuthProvider、无 Supabase 环境）
 * 必须得到完整本地能力：总览/趋势/周摘要/下一步建议/导出，全部可用，
 * 数据来源标识为「本机」，绝不出现登录墙或空白占位。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { StatsClient } from "./stats-client";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});

const { localDateStr, shiftDate } = await import("@/lib/date-utils");
const zh = (await import("@/lib/i18n-stats")).STATS_DICTS.zh;

const chapters = [
  { slug: "getting-started", docCount: 2 },
  { slug: "spot", docCount: 3 },
];
const today = localDateStr();

function seedRichLocal(): void {
  const at = (d: string) => new Date(`${d}T12:00:00`).getTime();
  store.set("tb-progress", JSON.stringify({ "getting-started": ["a", "b"], spot: ["c"] }));
  store.set("tb-progress-completions", JSON.stringify({
    "getting-started:a": { chapter: "getting-started", doc: "a", at: at(shiftDate(today, -1)) },
  }));
  store.set("tb-quiz-getting-started", JSON.stringify({ best: 8, done: true }));
  store.set("tb-quiz-attempt-ledger", JSON.stringify({
    "getting-started:1": { chapter: "getting-started", best: 8, total: 10, at: at(today) },
  }));
  store.set("tb-wrong", JSON.stringify({
    "spot:0": { chapterNum: "spot", questionIdx: 0, picked: 1, at: at(today), srsStage: 1, srsDue: today },
  }));
  store.set("tb-review-attempt-ledger", JSON.stringify({
    "spot:0:1": { chapter: "spot", questionIdx: 0, correct: true, mastered: false, stage: 1, at: at(today) },
  }));
  store.set("tb-replay-history", JSON.stringify([
    { at: at(today), symbol: "BTCUSDT", interval: "1h", total: 10, correct: 7, bestStreak: 4, durationSec: 300 },
  ]));
  store.set("tb-study-time", JSON.stringify({ [today]: { read: 1800 } }));
}

beforeEach(() => store.clear());
afterEach(() => cleanup());

describe("R12.24 guest-mode stats degradation", () => {
  it("renders every stats section fully from localStorage without auth", async () => {
    seedRichLocal();
    render(<StatsClient chapters={chapters} dict={zh} locale="zh" />);

    // 总览卡
    expect(await screen.findByText(zh.overviewTitle)).toBeInTheDocument();
    // 数据来源 = 本机
    expect(screen.getByLabelText("本机数据")).toBeInTheDocument();
    expect(screen.queryByText("本机 + 云端")).not.toBeInTheDocument();
    // 四大趋势区
    expect(screen.getByText(zh.trendTitle)).toBeInTheDocument();
    expect(screen.getByText(zh.quizTrendTitle)).toBeInTheDocument();
    expect(screen.getByText(zh.reviewTrendTitle)).toBeInTheDocument();
    expect(screen.getByText(zh.replayTrendTitle)).toBeInTheDocument();
    // 周摘要 + 周报
    expect(screen.getByText(zh.weekSummaryTitle)).toBeInTheDocument();
    expect(screen.getByText(zh.weeklyTitle)).toBeInTheDocument();
    // 下一步建议（有错题→复习）
    expect(screen.getByText(zh.nextDueReviewTpl.replace("{n}", "1"))).toBeInTheDocument();
    // 时间范围切换可用
    fireEvent.click(screen.getByRole("button", { name: zh.rangeDaysTpl.replace("{n}", "30") }));
    expect(store.get("tb-stats-range-days")).toBe("30");
  });

  it("guest export produces a complete versioned payload", async () => {
    seedRichLocal();
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const anchor = document.createElement("a");
    Object.defineProperty(anchor, "click", { value: vi.fn() });
    const origCreate = document.createElement.bind(document);
    const createSpy = vi
      .spyOn(document, "createElement")

      .mockImplementation(((tag: string, ...rest: unknown[]) =>
        tag === "a" ? anchor : (origCreate as unknown as (...args: unknown[]) => Node)(tag, ...rest)) as never);

    render(<StatsClient chapters={chapters} dict={zh} locale="zh" />);
    fireEvent.click(await screen.findByRole("button", { name: zh.dataExportBtn }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = (createObjectURL.mock.calls[0] as unknown[])[0] as Blob;
    const parsed = JSON.parse(await blob.text());
    expect(parsed.format).toBe("trade-buty-stats-export");
    expect(parsed.version).toBe(1);
    expect(parsed.data.courses.readDocs).toBe(3);
    expect(parsed.data.quizzes.done).toBe(1);
    expect(parsed.data.replay.rounds).toBe(1);
    expect(parsed.data.review.pending).toBe(1);
    expect(anchor.download).toMatch(/^trade-buty-stats-\d{4}-\d{2}-\d{2}\.json$/);
    createSpy.mockRestore();
  });

  it("never shows a login wall or degraded placeholder", async () => {
    seedRichLocal();
    render(<StatsClient chapters={chapters} dict={zh} locale="zh" />);
    await screen.findByText(zh.overviewTitle);
    expect(screen.queryByText(/登录后|请先登录|sign in/i)).not.toBeInTheDocument();
  });
});
