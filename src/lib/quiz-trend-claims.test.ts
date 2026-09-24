/**
 * R16.130：测验趋势卡那句话，必须说清它下面四格里哪两格跟着区间变、哪两格不跟。
 *
 * 这一节顶上有一个区间选择器（近 7 / 30 / 90 天），但四格里只有「测验次数」「期间最高」
 * 真跟着区间走：`attemptsInRange`、`bestInRangeText` 由窗口内的作答算出；而「平均得分」
 * (`latest.avgPct`) 与「测验完成」(`latest.doneQuizzes`) 读的是你**全部**测验的当前成绩，
 * 换区间一动不动。原来那句 promise 是「旧成绩不会伪造历史日期，但仍会显示当前最高分」——
 * 这一节压根不印「当前最高分」那个数（`latest.bestPct` 在统计页没有任何渲染点），
 * 印的是平均分；而「换个区间有两个数不变」这件事一句没提，用户读到的就是一屏假联动。
 *
 * 说明文字由 `stats-client.tsx` 直接渲染（无占位符替换），所以门禁要求它把四格的
 * **标签原词**都写进去：以后任何一格改名而这句话没跟上，这里就红。
 *
 * 运行：`npx vitest run src/lib/quiz-trend-claims.test.ts`（跟随 `npm test`）
 */
import { describe, expect, it } from "vitest";
import { STATS_DICTS } from "./i18n-stats";
import { buildQuizScoreTrend } from "./quiz-score-trend";

/** 趋势卡下面那四格：`stats-client.tsx` 里紧跟在这句话后面的四个 `<dt>` */
const CARD_LABELS = ["quizTrendAttempts", "quizBestInRange", "quizAvgScore", "quizzes"] as const;

describe("测验趋势卡的说明与它真的印出来的四格对齐", () => {
  for (const locale of ["zh", "en"] as const) {
    const dict = STATS_DICTS[locale];

    it(`${locale}: 四格的标签原词都出现在这句话里`, () => {
      const missing = CARD_LABELS.filter((key) => !dict.quizTrendDesc.includes(dict[key]));
      expect(missing, `这句话没点名这些卡片：${missing.map((k) => dict[k]).join("、")}`).toEqual([]);
      // 扫描分母：四格都改名成同一个词，这条检查也就废了
      expect(new Set(CARD_LABELS.map((key) => dict[key])).size).toBe(CARD_LABELS.length);
    });

    it(`${locale}: 这句话里不留任何未替换的占位符`, () => {
      expect(dict.quizTrendDesc, `组件是原样渲染这句的：${dict.quizTrendDesc}`).not.toMatch(/\{[a-zA-Z]+}/);
    });

    // 被收回的那句原话。趋势节印的是「平均得分」，`latest.bestPct`（当前最高百分比）
    // 在这一页没有任何渲染点——承诺它，就是承诺一个屏幕上不存在的数。
    it(`${locale}: 不再承诺「会显示当前最高分」`, () => {
      expect(dict.quizTrendDesc).not.toMatch(/当前最高分|current best/i);
    });
  }

  /** 「区间两格」与「全量两格」是两种行为，不是同一把尺子的两种说法 */
  const chapters = [
    { slug: "getting-started", questions: 10 },
    { slug: "spot", questions: 10 },
  ];
  const at = (month: number, day: number) => new Date(2026, month - 1, day, 12).getTime();
  const input = {
    chapters,
    progress: {
      "getting-started": { best: 8, done: true },
      spot: { best: 4, done: true },
    },
    attempts: {
      "getting-started:1": { chapter: "getting-started", best: 8, total: 10, at: at(9, 5) },
      "spot:1": { chapter: "spot", best: 4, total: 10, at: at(8, 20) },
    },
    today: "2026-09-07",
  };

  it("没有本地日期的当前成绩：全量两格有数，区间两格为空", () => {
    const t = buildQuizScoreTrend({ chapters, progress: input.progress, days: 7, today: "2026-09-07" });
    expect(t.summary.attemptsInRange).toBe(0);
    expect(t.summary.bestInRangeText).toBeNull();
    expect(t.latest.avgPct).not.toBeNull();
    expect(t.latest.doneQuizzes).toBe(2);
  });

  it("换区间只动「测验次数 / 期间最高」，不动「平均得分 / 测验完成」", () => {
    const week = buildQuizScoreTrend({ ...input, days: 7 });
    const quarter = buildQuizScoreTrend({ ...input, days: 90 });
    expect(week.summary.attemptsInRange).toBe(1);
    expect(quarter.summary.attemptsInRange).toBe(2);
    expect(quarter.summary.bestInRangeText).toBe("8/10");
    expect(week.summary.bestInRangeText).toBe("8/10");
    expect(quarter.latest.avgPct).toBe(week.latest.avgPct);
    expect(quarter.latest.doneQuizzes).toBe(week.latest.doneQuizzes);
  });
});
