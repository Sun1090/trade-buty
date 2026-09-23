// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { STUDY_LEDGER_KEEP_DAYS } from "./study-time";
import {
  STATS_EXPORT_FORMAT,
  STATS_EXPORT_VERSION,
  buildStatsExport,
  downloadStatsExport,
  serializeStatsExport,
} from "./stats-export";

const fullInput = {
  locale: "zh",
  courses: { readDocs: 8, totalDocs: 20, doneChapters: 2, totalChapters: 5, completionPct: 40 },
  quizzes: { done: 3, total: 5, avgBestPct: 90 },
  replay: { rounds: 12, accuracyPct: 67, bestStreak: 6 },
  review: { pending: 4, dueToday: 2, overdue: 1 },
  engagement: { studySeconds: 7500, currentStreak: 3, longestStreak: 9 },
  goals: { dailyGoalMinutes: 20 },
};

/** 压成排序后的「section.field」叶子路径清单：字段名契约的可执行形式 */
function leafPaths(value: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === "object") {
      out.push(...leafPaths(child as Record<string, unknown>, path));
    } else {
      out.push(path);
    }
  }
  return out.sort();
}

describe("buildStatsExport", () => {
  it("produces a versioned, identifiable payload with stable field names", () => {
    const payload = buildStatsExport(fullInput, new Date("2026-09-11T12:00:00Z"));
    expect(payload.format).toBe(STATS_EXPORT_FORMAT);
    expect(payload.version).toBe(STATS_EXPORT_VERSION);
    expect(payload.exportedAt).toBe("2026-09-11T12:00:00.000Z");
    expect(payload.locale).toBe("zh");
    expect(Object.keys(payload.data).sort()).toEqual(["courses", "engagement", "goals", "quizzes", "replay", "review"]);
    expect(payload.data.courses).toEqual(fullInput.courses);
    expect(payload.data.goals).toEqual(fullInput.goals);
  });

  /**
   * 文件自己的契约写着「字段命名稳定：改名/改语义要连着版本号一起动」
   * （见 `stats-export.ts` 头部）。这条把契约变成可执行的：整棵叶子路径钉死，
   * 顺手改名、删除或挪 section 都会红。R16.11 走的就是这条通道——v1 的两个名不副实
   * 的键（`bestPct` 装平均、`totalStudySeconds` 其实是窗口合计）随 v2 一并改掉。
   */
  it("字段命名契约：整棵叶子路径钉死，改名要显式过这里", () => {
    const payload = buildStatsExport(fullInput, new Date("2026-09-11T12:00:00Z"));
    const paths = leafPaths(payload as unknown as Record<string, unknown>);

    expect(paths.length, "清单本身不能是空的").toBeGreaterThanOrEqual(23);
    expect(paths).toEqual([
      "data.courses.completionPct",
      "data.courses.doneChapters",
      "data.courses.readDocs",
      "data.courses.totalChapters",
      "data.courses.totalDocs",
      "data.engagement.currentStreak",
      "data.engagement.longestStreak",
      "data.engagement.studySeconds",
      "data.engagement.studyWindowDays",
      "data.goals.dailyGoalMinutes",
      "data.quizzes.avgBestPct",
      "data.quizzes.done",
      "data.quizzes.total",
      "data.replay.accuracyPct",
      "data.replay.bestStreak",
      "data.replay.rounds",
      "data.review.dueToday",
      "data.review.overdue",
      "data.review.pending",
      "exportedAt",
      "format",
      "locale",
      "version",
    ]);
    expect(STATS_EXPORT_VERSION, "再改名要连着版本一起决策").toBe(2);
    // 窗口天数取自裁剪台账的同一个常量：把 90 写死在导出里，改窗口就没人发现
    expect(payload.data.engagement.studyWindowDays).toBe(STUDY_LEDGER_KEEP_DAYS);
  });

  it("sanitizes corrupt numeric inputs and nullable percentages", () => {
    const dirty = JSON.parse(JSON.stringify(fullInput));
    dirty.courses.readDocs = Number.NaN;
    dirty.quizzes.avgBestPct = 150;
    dirty.replay.accuracyPct = -5;
    dirty.engagement.currentStreak = Number.POSITIVE_INFINITY;
    dirty.goals.dailyGoalMinutes = -1;
    const payload = buildStatsExport(dirty);
    expect(payload.data.courses.readDocs).toBe(0);
    expect(payload.data.quizzes.avgBestPct).toBe(100);
    expect(payload.data.replay.accuracyPct).toBe(0);
    expect(payload.data.engagement.currentStreak).toBe(0);
    expect(payload.data.goals.dailyGoalMinutes).toBe(0);
  });

  it("nulls missing percentages and coerces unexpected locales to zh", () => {
    const input = {
      ...fullInput,
      locale: "zh-TW",
      quizzes: { ...fullInput.quizzes, avgBestPct: null },
    };
    const payload = buildStatsExport(input);
    expect(payload.data.quizzes.avgBestPct).toBeNull();
    expect(payload.locale).toBe("zh");
  });

  it("round-trips through JSON without loss", () => {
    const payload = buildStatsExport(fullInput, new Date("2026-09-11T12:00:00Z"));
    expect(JSON.parse(serializeStatsExport(payload))).toEqual(JSON.parse(JSON.stringify(payload)));
  });
});

describe("downloadStatsExport", () => {
  it("creates a dated json blob and clicks a temporary anchor", () => {
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const payload = buildStatsExport(fullInput, new Date("2026-09-11T12:00:00Z"));
    const anchor = document.createElement("a");
    let clicked = false;
    Object.defineProperty(anchor, "click", { value: () => { clicked = true; } });
    const createSpy = vi.spyOn(document, "createElement").mockReturnValue(anchor);
    const name = downloadStatsExport(payload);
    expect(name).toBe("trade-buty-stats-2026-09-11.json");
    expect(clicked).toBe(true);
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(anchor.download).toBe(name);
    createSpy.mockRestore();
  });
});
