/**
 * R16.57：篇章「已读几篇」全站只有一个出口。
 *
 * `readDocsForChapter`（`learning-overview.ts`）的注释自称为「唯一口径」，但曾经有四处在它旁边
 * 各算各的：`course-completion-trend.ts` 抄了一份等价的去重+封顶、`stats-client.tsx` 三处直接取
 * 数组原始长度、`chapter-complete-celebration.tsx` 干脆自己 `JSON.parse(localStorage)` 再取长度。
 * 前三处在真实数据上算得一样（`readProgress()` 已经去过重），所以这条用例钉的是「不许再长出一
 * 份第二口径」；最后那处不一样——它绕开了 `readProgress()` 的归一化，见下面组件用例。
 *
 * 「空篇章算不算完成」是这条口径唯一的真实分歧：趋势卡与课文侧栏判 `docCount > 0`，
 * overview 与 `readSummary` 只判 `>= docCount`，于是章节数为 0 的篇章（英文章节回填期间、
 * 或整章读取失败）在两张卡上一个算完成一个不算。现在四处同一判据。
 * 今天内容仓 zh/en 两棵树都没有 0 课的篇章（`getChapters` 实测），所以这条修复不改变任何
 * 一个正在显示的数字——它挡的是下一篇英文课文被清空的那一天。
 *
 * 运行：`npx vitest run src/lib/read-count-owner.test.ts`（跟随 `npm test`）
 */
import { describe, expect, it } from "vitest";
import { buildCourseCompletionTrend } from "./course-completion-trend";
import { readSummary } from "./learn-stats";
import { buildLearningOverview, readDocsForChapter } from "./learning-overview";
import { localDateStr, shiftDate } from "./date-utils";

/** 两个有课的篇章 + 一个 0 课的篇章（后者是本轮判据的分歧点） */
const CHAPTERS = [
  { slug: "getting-started", docCount: 2 },
  { slug: "spot", docCount: 3 },
  { slug: "empty-chapter", docCount: 0 },
];

/** 脏数据：重复键、非字符串项、空串——`readProgress()` 会清掉，聚合器自己也得扛住 */
const JUNK_PROGRESS = {
  "getting-started": ["a", "a", "b", 42, ""],
  spot: ["c", "c", "d"],
  "empty-chapter": [],
} as unknown as Record<string, string[]>;

describe("已读数只有一个口径", () => {
  it("同一份脏进度喂给四个消费者，读数与完成章数一致", () => {
    const expectedReadDocs = 4; // getting-started 2（封顶）+ spot 2 + 空章 0
    const expectedDoneChapters = 1; // 只有 getting-started；空篇章不算

    expect(readDocsForChapter(JUNK_PROGRESS["getting-started"], 2)).toBe(2);
    expect(readDocsForChapter(JUNK_PROGRESS.spot, 3)).toBe(2);

    const summary = readSummary(JUNK_PROGRESS, CHAPTERS);
    expect(summary.readDocs).toBe(expectedReadDocs);
    expect(summary.doneChapters).toBe(expectedDoneChapters);

    const overview = buildLearningOverview({ progress: JUNK_PROGRESS, chapters: CHAPTERS });
    expect(overview.courses.readDocs).toBe(expectedReadDocs);
    expect(overview.courses.doneChapters).toBe(expectedDoneChapters);

    const trend = buildCourseCompletionTrend({
      chapters: CHAPTERS,
      progress: JUNK_PROGRESS,
      completions: {},
      days: 7,
    });
    expect(trend.latest.readDocs).toBe(expectedReadDocs);
    expect(trend.latest.doneChapters).toBe(expectedDoneChapters);
  });

  it("0 课的篇章不算完成，四个判据同向", () => {
    const chapters = [{ slug: "empty-chapter", docCount: 0 }];
    const progress = { "empty-chapter": [] } as unknown as Record<string, string[]>;

    expect(readSummary(progress, chapters).doneChapters).toBe(0);
    expect(buildLearningOverview({ progress, chapters }).courses.doneChapters).toBe(0);
    expect(
      buildCourseCompletionTrend({ chapters, progress, completions: {}, days: 7 }).latest.doneChapters,
    ).toBe(0);
  });

  /**
   * 进度封顶这件事的原有语义仍然在：读完的键比篇章课数多（旧课文被改名的那部分不在本节
   * 范围，见 roadmap 的 R16.58），读数不得超过总课数，完成度不会超过 100%。
   */
  it("已读数不会顶过篇章课数", () => {
    const progress = { spot: ["c", "d", "e", "f", "g"] } as unknown as Record<string, string[]>;
    const chapters = [{ slug: "spot", docCount: 3 }];
    const summary = readSummary(progress, chapters);
    expect(summary.readDocs).toBe(3);
    expect(summary.overallPct).toBe(100);
    const today = localDateStr();
    expect(
      buildCourseCompletionTrend({
        chapters,
        progress,
        completions: {
          "spot:c": { key: "spot:c", chapter: "spot", doc: "c", at: new Date(`${shiftDate(today, -1)}T12:00:00`).getTime() },
        },
        days: 7,
      }).latest.readDocs,
    ).toBe(3);
  });
});
