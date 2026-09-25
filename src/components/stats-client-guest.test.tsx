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
const { STUDY_LEDGER_KEEP_DAYS } = await import("@/lib/study-time");
const { REPLAY_HISTORY_KEEP } = await import("@/lib/replay-history-limit");
const { STATS_EXPORT_VERSION } = await import("@/lib/stats-export");
const { QUIZZES } = await import("@/lib/quizzes");
const { quizScorePct } = await import("@/lib/quiz-score");

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
  store.set("tb-quiz-attempts", JSON.stringify({
    "getting-started:1": { chapter: "getting-started", best: 8, total: 10, at: at(today) },
  }));
  store.set("tb-wrong", JSON.stringify({
    "spot:0": { chapterNum: "spot", questionIdx: 0, picked: 1, at: at(today), srsStage: 1, srsDue: today },
  }));
  store.set("tb-review-attempts", JSON.stringify({
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
    // R16.249：这颗卡的账以前种在 `tb-review-attempt-ledger` 下，而读取端要的是
    // `tb-review-attempts`——夹具写了、读取端不收，于是「游客模式全部从 localStorage 渲染」
    // 这个用例其实一路演的是空账，连「当前错题缺少复习日期」那句都印了出来。两头必须握手。
    const reviewsCard = screen.getByText(zh.reviewTrendReviews).parentElement;
    const accuracyCard = screen.getByText(zh.reviewTrendAccuracy).parentElement;
    expect(reviewsCard?.querySelector("dd")?.textContent).toBe("1");
    expect(accuracyCard?.querySelector("dd")?.textContent).toBe("100%");
    expect(screen.queryByText(zh.reviewNoDates)).not.toBeInTheDocument();
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
    /**
     * R16.182：把台账改成「最后一次学习是 120 天前」——窗口头尾必须跟着台账走，
     * 而不是跟着导出那一刻的日期走。这一层只有走真实按钮才验得到。
     */
    const idleDay = shiftDate(today, -120);
    store.set("tb-study-time", JSON.stringify({ [idleDay]: { read: 1800 } }));
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
    expect(parsed.version).toBe(STATS_EXPORT_VERSION);
    /**
     * R16.11：`avgBestPct` / `studySeconds` / `studyWindowDays` 是 v1→v2 改名或新增的键。
     * 纯函数那份叶子路径清单钉不住这里——它自己喂自己；只有走真实按钮，
     * 才能抓到 `stats-client` 到 `buildStatsExport` 之间写错的键名。
     */
    expect(parsed.data.quizzes.avgBestPct).toBe(quizScorePct(8, QUIZZES["getting-started"].questions.length));
    expect(parsed.data.engagement.studySeconds).toBe(1800);
    expect(parsed.data.engagement.studyWindowDays).toBe(STUDY_LEDGER_KEEP_DAYS);
    // R16.182：两个窗口的边界各来自一份常量 / 一本台账，键名与值都要走通一次
    expect(parsed.data.replay.historyRoundCap).toBe(REPLAY_HISTORY_KEEP);
    expect(parsed.data.replay.allTimeBestStreak).toBe(4);
    expect(parsed.data.engagement.studyWindowFirstDay).toBe(idleDay);
    expect(parsed.data.engagement.studyWindowLastDay).toBe(idleDay);
    // 窗口尾不是导出日：这两件事在文件里各写各的
    expect(parsed.data.engagement.studyWindowLastDay).not.toBe(String(parsed.exportedAt).slice(0, 10));
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
