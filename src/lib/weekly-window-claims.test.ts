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
import { readFileSync } from "node:fs";
import path from "node:path";
import { STATS_DICTS } from "./i18n-stats";
import { ACTIVE_DAY_MIN_SECONDS, WEEK_WINDOW_DAYS, buildWeeklySummary } from "./weekly-summary";
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

  // 同一屏上「近 7 天」出现了两次，量的却是两件事：
  // - 摘要卡：`buildWeeklySummary` 数的是当日**去重秒数 ≥ `ACTIVE_DAY_MIN_SECONDS`** 的那些天；
  // - 迷你条：`activity-calendar` 的日期集合，那天只要 `touchStreak` 过一次就亮，一秒都不算。
  // 于是两个数可以互相超出——只在页面停留 30 秒的人，摘要里那一天不活跃、条上却有；
  // 只标了一课已读的人，条上有、摘要里也不算。旧写法一句叫「{d} 天活跃」、一句叫
  // 「近 7 天学习记录」，两个名字都听不出尺子不同，读的人只会当成同一个数的两种说法。
  it("两把尺子各自点名自己量的是什么", () => {
    const zh = STATS_DICTS.zh.weekSummaryTpl;
    const en = STATS_DICTS.en.weekSummaryTpl;
    const bar = readFileSync(path.join(process.cwd(), "src/components/week-mini-bar.tsx"), "utf8");
    const wiring = readFileSync(path.join(process.cwd(), "src/components/stats-client.tsx"), "utf8");

    expect(
      Number.isInteger(ACTIVE_DAY_MIN_SECONDS / 60),
      `${ACTIVE_DAY_MIN_SECONDS} 秒不是整分钟，文案里那个数就没法读`,
    ).toBe(true);
    expect(wiring, "{min} 必须由 ACTIVE_DAY_MIN_SECONDS 代入，不许手抄").toContain(
      '.replace("{min}", String(ACTIVE_DAY_MIN_SECONDS / 60))',
    );
    const rendered = Object.entries({
      "{m}": String(Math.round(ACTIVE_DAY_MIN_SECONDS / 60) * 2),
      "{d}": "3",
      "{min}": String(ACTIVE_DAY_MIN_SECONDS / 60),
      "{docs}": "1",
      "{quiz}": "2",
      "{review}": "4",
      "{replay}": "5",
    }).reduce((acc, [token, value]) => acc.split(token).join(value), zh);
    expect(rendered, "代入常量之后那句要真的读出「1 分钟」").toContain("1 分钟");

    const VAGUE = /活跃|active days/i;
    expect(zh, `摘要卡那句还在用一把没说明的尺：${zh}`).not.toMatch(VAGUE);
    expect(en, `摘要卡那句还在用一把没说明的尺：${en}`).not.toMatch(VAGUE);

    const barPhrase = bar.match(/近 7 天里哪几天[\s\S]{0,90}/)?.[0] ?? "";
    expect(barPhrase, "迷你条的读屏名字要点名它记的是哪三种事").toMatch(/标过已读|答过题|回放/);
    expect(barPhrase, "那一格按时长算就错了，句子里不许有分钟").not.toMatch(/分钟/);

    // 正向对照：退役的三句喂给同一组禁令，必须条条报红
    const legacyVague = [
      "近 7 天共学 {m} 分钟 · {d} 天活跃 · 完成 {docs} 篇",
      "{m} min across {d} active days in the last 7 days",
    ];
    expect(legacyVague.filter((s) => !VAGUE.test(s)), "旧写法逃过了「活跃」禁令").toEqual([]);
    expect(
      /标过已读|答过题|回放/.test("近 7 天学习记录（从 6 天前到今天）："),
      "旧的读屏名字什么都没点名",
    ).toBe(false);
  });
});
