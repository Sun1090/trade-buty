/**
 * R16.129：滚动窗口不许叫「本周」。
 *
 * `/stats` 那张摘要卡统计的是「今天在内向前 7 个自然日」（`weekly-summary.ts` 的 `weekBounds`），
 * 卡片右上角还把起止日期印出来——`2026-09-18 ~ 2026-09-24` 本身就跨了两个日历周。可标题写着
 * 「本周学习摘要 / Weekly learning summary」，目标那行写着「每周目标 / Weekly goal」，
 * 而**同一屏**上面三行的柱状图（`weeklyTitle`）老老实实叫「近 7 天」。同一段时间在一张页面上
 * 有两种名字，其中一种还是错的：读「本周」的人会以为周日晚刷新、以为周一的数字该从零开始。
 *
 * 现在这几句里的天数由 `WEEK_WINDOW_DAYS` 生成：窗口长度一改，文案跟着改，改不动就红。
 * 注意「复习提醒 / 每周一次」不在这次范围内——那颗的去重键是 `localWeekStr()`（ISO-8601 日历周），
 * 它说的确实是一个日历周，那句是真的。
 *
 * 运行：`npx vitest run src/lib/weekly-window-claims.test.ts`（跟随 `npm test`）
 */
import { describe, expect, it } from "vitest";
import { STATS_DICTS } from "./i18n-stats";
import { WEEK_WINDOW_DAYS, buildWeeklySummary } from "./weekly-summary";
import { localDateStr } from "./date-utils";

/** 统计页里那些「其实是一段滚动窗口」的文案 */
const WINDOW_KEYS = [
  "weekSummaryTitle",
  "weekSummaryTpl",
  "weekGoalLabel",
  "weekGoalAchieved",
  "weekGoalLeftTpl",
  "weeklyTitle",
  "weeklySummaryTpl",
] as const;

/** 日历周的说法：滚动窗口不配叫这些名字 */
const CALENDAR_WEEK_CLAIM = /本周|这周|每周|this week|weekly/i;

describe("滚动 7 天窗口的文案说出它真的是 7 天", () => {
  for (const locale of ["zh", "en"] as const) {
    const dict = STATS_DICTS[locale];

    it(`${locale}: 扫描认得全部 ${WINDOW_KEYS.length} 个键（少一个就是门禁瞎了）`, () => {
      const missing = WINDOW_KEYS.filter((key) => typeof dict[key] !== "string" || dict[key].length === 0);
      expect(missing, `这些窗口文案键没有值：${missing.join(", ")}`).toEqual([]);
    });

    it(`${locale}: 没有一个字承诺「日历周」`, () => {
      for (const key of WINDOW_KEYS) {
        expect(dict[key], `「${key}」= ${dict[key]} 把滚动窗口说成了日历周`).not.toMatch(CALENDAR_WEEK_CLAIM);
      }
    });

    it(`${locale}: 每一句报出的天数就是窗口真正的长度`, () => {
      for (const key of WINDOW_KEYS) {
        expect(dict[key], `「${key}」= ${dict[key]} 没写出 ${WEEK_WINDOW_DAYS} 天`).toContain(String(WEEK_WINDOW_DAYS));
      }
    });
  }

  it("zh 的窗口说法与同一屏柱状图的「近 N 天」是同一串字", () => {
    // 柱状图叫「近 7 天」、趋势区间选择器叫「近 7 天」，摘要卡也必须用同一串字，不是「近七日」或「本周」
    expect(STATS_DICTS.zh.weekSummaryTitle.startsWith(STATS_DICTS.zh.trendRange)).toBe(true);
    expect(STATS_DICTS.zh.trendRange).toBe(STATS_DICTS.zh.rangeDaysTpl.replace("{n}", String(WEEK_WINDOW_DAYS)));
  });

  it("窗口真的就是 WEEK_WINDOW_DAYS 个自然日（含今天）", () => {
    const summary = buildWeeklySummary({
      dailySeconds: [],
      completions: {},
      quizAttempts: {},
      reviewAttempts: {},
      replayHistory: [],
      weeklyGoalMin: 90,
      now: new Date(2026, 8, 24, 12),
    });
    const days =
      (new Date(`${summary.weekEnd}T12:00:00`).getTime() - new Date(`${summary.weekStart}T12:00:00`).getTime()) /
      86_400_000 +
      1;
    expect(days).toBe(WEEK_WINDOW_DAYS);
    expect(summary.weekStart).toBe("2026-09-18");
    expect(summary.weekEnd).toBe(localDateStr(new Date(2026, 8, 24, 12)));
  });
});
