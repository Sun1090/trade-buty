/**
 * R16.57：**封顶**这把尺只有一个出口。
 *
 * `readDocsForChapter`（`learning-overview.ts`）曾经自称「已读几篇的唯一口径」，而四处在它旁边
 * 各算各的：`course-completion-trend.ts` 抄了一份等价的去重+封顶、`stats-client.tsx` 三处直接取
 * 数组原始长度、`chapter-complete-celebration.tsx` 干脆自己 `JSON.parse(localStorage)` 再取长度。
 * 前三处在真实数据上算得一样（`readProgress()` 已经去过重），所以这条用例钉的是「不许再长出一
 * 份第二封顶」；最后那处不一样——它绕开了 `readProgress()` 的归一化，见下面组件用例。
 *
 * R16.122 之后确实有了第二把尺：`readDocsInChapter`（存储键 ∩ 章内课表），用在拿得到课表的三处
 * （课文清单、侧栏进度、完成礼花），它比封顶更严。本文件只管封顶这把尺的四个消费者；
 * 两边的边界写在 `learning-overview.ts` 各自的注释里。
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
import {
  assertDocCountMatchesList,
  buildLearningOverview,
  readDocsForChapter,
  readDocsInChapter,
} from "./learning-overview";
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

describe("封顶口径只有一个出口", () => {
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
   * 范围，R16.122 已按「同一屏同一口径」收敛），读数不得超过总课数，完成度不会超过 100%。
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

/**
 * R16.58/R16.122 的收口：两把尺的分母必须是同一个来源。
 *
 * 这一段补的不是「又一把尺」，而是两把尺之间的**那条缝**。`chapter-rail.tsx` 拿
 * `docCount` 当分母、拿 `readDocsInChapter`（存储键 ∩ 清单）当分子——两个数一旦来自
 * 不同来源，同一屏就能同时出现「清单说还差一篇、进度条已经满了」。
 *
 * `assertDocCountMatchesList` 就是钉住那条缝的：清单和 docCount 一起传进来却对不上时
 * 抛错。今天线上两者必然相等（docCount 由构建期同一份 `docMetas` 算出），所以这条用例
 * 不会靠真实数据通过——它拿手工造出来的不一致喂进去，确保那一天真的有人被拦下。
 */
describe("两把尺的分母必须是同一个来源", () => {
  const SLUGS = ["a", "b", "c"];

  it("docCount 与清单长度一致时安静通过", () => {
    expect(() => assertDocCountMatchesList(3, SLUGS, "用例")).not.toThrow();
    expect(() => assertDocCountMatchesList(0, [], "用例")).not.toThrow();
  });

  it("docCount 大于清单长度时抛错，并把两个数与出处一起念出来", () => {
    let message = "";
    try {
      assertDocCountMatchesList(7, SLUGS, "ChapterRail 的进度分母");
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message, "不一致时安静通过 = 同一屏两个分母").toContain("ChapterRail 的进度分母");
    expect(message).toContain("docCount=7");
    expect(message).toContain("=3");
  });

  it("docCount 小于清单长度同样抛错（少算那一侧也算错）", () => {
    expect(() => assertDocCountMatchesList(2, SLUGS, "用例")).toThrow(/docCount=2/);
  });

  it("禁令抓得住旧写法：不等就静默采信 docCount，正是 R16.122 要修的那类同一屏两个答案", () => {
    const legacy = (docCount: number, list: readonly string[]) => Math.min(
      new Set(list).size,
      Math.max(0, docCount),
    );
    expect(legacy(7, SLUGS), "这条旧写法的样例本身得算出 3（封顶到清单长度）").toBe(3);
    expect(legacy(7, SLUGS)).not.toBe(7);
  });

  it("交集口径在不一致时确实比 docCount 小——这正是必须报错的理由", () => {
    const stored = ["a", "b", "c", "gone-1", "gone-2", "gone-3", "gone-4"];
    // docCount 仍是改课之前的 7，清单已经缩到 3：交集 3 < 封顶 7
    expect(readDocsInChapter(stored, SLUGS)).toBe(3);
    expect(readDocsForChapter(stored, 7)).toBe(7);
    expect(readDocsInChapter(stored, SLUGS)).toBeLessThan(readDocsForChapter(stored, 7));
    // 两个分母同时到场就必须当场拦下
    expect(() => assertDocCountMatchesList(7, SLUGS, "用例")).toThrow();
  });

  it("扫描地板：真的能碰到这一段而不是空跑", () => {
    expect(SLUGS.length, "上面的用例全靠这份清单，空了就是空转").toBeGreaterThan(0);
    expect(readDocsInChapter(["a", "b"], SLUGS), "交集必须仍小于清单长度（用例才有意义）").toBe(2);
  });
});
