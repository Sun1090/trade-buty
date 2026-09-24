// @vitest-environment jsdom
/**
 * R16.125：「测验完成」在 `/stats` 上只能有一个意思。
 *
 * 统计页有两张卡顶着同一个标签：概览卡（`stats-client.tsx` 的 `StatCard`）读
 * `aggregateStats()` 的 `quizzesDone`，测验趋势卡读 `buildQuizScoreTrend()` 的
 * `latest.doneQuizzes`。它们喂的是同一份 localStorage，判据却曾经不同：
 *
 * - 概览卡：`p?.done`（`learn-stats.ts`），0 分也算完成；
 * - 趋势卡：`done && best > 0`，全答错的那一套直接不算；
 * - 答题账本：`quiz-store.ts` / `quiz-attempt-ledger.ts` 又各自把 0 分的记录丢掉，
 *   于是趋势卡的「测验次数」也少一次；
 * - 日期桶：`bestPct !== null` 才记 attempts，所以就算账本里有 0 分那条，当天仍是 0 次。
 *
 * 换句话说「做完全错的 10 道题」这一件真实发生过的事，在同一屏上被四段代码各自决定
 * 要不要承认。现在四处都只认 `done` 这一个标记——反过来也一样：`{best: 5, done: false}`
 * 这种存档在两张卡上都不算完成（有分数不等于做完了）。
 *
 * 本文件按 `stats-client.tsx` 的真实取数路径喂同一份存储，要求两侧读数逐项相等。
 *
 * 运行：`npx vitest run src/lib/quiz-completion-caliber.test.ts`（跟随 `npm test`）
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { aggregateStats } from "./learn-stats";
import { QUIZZES } from "./quizzes";
import { readQuizProgress } from "./quiz-store";
import { readQuizAttemptLedger } from "./quiz-attempt-ledger";
import { buildQuizScoreTrend } from "./quiz-score-trend";
import { localDateStr } from "./date-utils";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});

/** 与 `stats-client.tsx` 同样的输入：趋势卡的 chapters/progress/attempts 都从存储现读 */
function bothSides() {
  const stats = aggregateStats([]);
  const trend = buildQuizScoreTrend({
    chapters: Object.keys(QUIZZES).map((slug) => ({ slug, questions: QUIZZES[slug].questions.length })),
    progress: Object.fromEntries(
      Object.keys(QUIZZES).map((slug) => [slug, readQuizProgress(slug) ?? { best: 0, done: false }])
    ),
    attempts: readQuizAttemptLedger(),
    days: 7,
    today: localDateStr(),
  });
  return { stats, trend };
}

const SLUGS = Object.keys(QUIZZES);
const todayMs = () => new Date(`${localDateStr()}T12:00:00`).getTime();

describe("「测验完成」两侧同一个判据", () => {
  beforeEach(() => store.clear());

  it("全答错的一套题：概览卡与趋势卡都算一次完成，次数也不漏", () => {
    const [first] = SLUGS;
    store.set(`tb-quiz-${first}`, JSON.stringify({ best: 0, done: true }));
    store.set(
      "tb-quiz-attempts",
      JSON.stringify({ [`${first}:${todayMs()}`]: { chapter: first, best: 0, total: QUIZZES[first].questions.length, at: todayMs() } })
    );

    const { stats, trend } = bothSides();
    expect(stats.quizzesDone).toBe(1);
    expect(trend.latest.doneQuizzes).toBe(1);
    expect(trend.summary.attemptsInRange).toBe(1);
    expect(stats.avgQuizScore).toBe(0);
    expect(trend.latest.avgPct).toBe(0);
  });

  it("有分数但没做完：两侧都不算完成", () => {
    const [first] = SLUGS;
    store.set(`tb-quiz-${first}`, JSON.stringify({ best: 5, done: false }));

    const { stats, trend } = bothSides();
    expect(stats.quizzesDone).toBe(0);
    expect(trend.latest.doneQuizzes).toBe(0);
    expect(stats.avgQuizScore).toBeNull();
    expect(trend.latest.avgPct).toBeNull();
  });

  it("混合存档（正分、0 分、未完成、损坏）下四组数字逐项相等", () => {
    const [first, second, third] = SLUGS;
    const total = QUIZZES[first].questions.length;
    store.set(`tb-quiz-${first}`, JSON.stringify({ best: total, done: true }));
    store.set(`tb-quiz-${second}`, JSON.stringify({ best: 0, done: true }));
    store.set(`tb-quiz-${third}`, JSON.stringify({ best: 3, done: false }));
    store.set(`tb-quiz-${SLUGS[3]}`, "{bad");
    store.set(
      "tb-quiz-attempts",
      JSON.stringify({
        [`${first}:1`]: { chapter: first, best: total, total, at: todayMs() },
        [`${second}:2`]: { chapter: second, best: 0, total: QUIZZES[second].questions.length, at: todayMs() },
      })
    );

    const { stats, trend } = bothSides();
    expect(stats.totalQuizzes).toBe(trend.latest.totalQuizzes);
    expect(stats.quizzesDone).toBe(trend.latest.doneQuizzes);
    expect(stats.quizzesDone).toBe(2);
    expect(stats.avgQuizScore).toBe(trend.latest.avgPct);
    // 「近 7 天测验次数」数的是账本里落在窗口内的作答，与分数无关
    expect(trend.summary.attemptsInRange).toBe(2);
  });
});
