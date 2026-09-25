/**
 * R16.197：断档那两句不许宣布「已经重新计数」，也不许许诺把原来的天数「接回来」。
 *
 * 那两句只在「断签且今天还没记录活动」的状态下渲染：
 * - 恢复卡（`buildStreakRecovery`）在 `!broken` 或 `todayMinutes > 0` 时直接 `show: false`；
 * - 今日目标那行是 `broken && !done`，而 `getStreakBreak().broken` 要求 `lastDate` 既不是
 *   今天也不是昨天、且不在 36 小时宽限窗内。
 * 也就是说这两句出现的那一刻，`getCurrentStreak()` 返回的是 **0**：计数没有「已经重新」开始，
 * 它是归零了。而 `touchStreak()` 在断签分支里写的是 `data.current = 1`（注释原话「断了，
 * 重新计 1」）——今天学一点得到的是 1，不是原来那 7 天，所以「接回来 / 就能续上」许诺的
 * 是一件代码里不存在的事（只有 `longest` 记着历史最长）。
 *
 * 这里两头夹：先把行为钉住（断签态下读到 0、记一次活动之后是 1、历史最长不变），
 * 再要求文案说的就是这个数；旧那三句喂给同一个禁令必须报红。
 */
// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { STATS_DICTS } from "./i18n-stats";
import { getCurrentStreak, getStreakBreak, readStreak, touchStreak } from "./streak";

/** 描述当前状态与接下来会发生什么的那两句 */
const STATE_KEYS = ["recoveryBodyTpl", "streakReassureTpl"] as const;
/** 三句里任何一句都不许许诺「原来的天数回来了」 */
const ALL_KEYS = ["recoveryTitle", ...STATE_KEYS] as const;

const RESUME_PROMISE = {
  zh: /续上|接回来|接着计|已经重新计数|重新计数了|回到原来的/,
  en: /has restarted|back on track|resume|reconnect|keep your streak/i,
} as const;

const ZERO_SAYS = { zh: /归零|清零/, en: /zero/i } as const;
const ONE_SAYS = { zh: /从 ?1/, en: /\bat 1\b/ } as const;

/** 一份「七天前就断了」的台账：曾经连过 7 天，历史最长 12 天 */
function seedBrokenStreak(): void {
  const dayMs = 24 * 60 * 60 * 1000;
  window.localStorage.setItem(
    "tb-streak",
    JSON.stringify({
      lastDate: "2020-01-01",
      current: 7,
      longest: 12,
      lastTs: Date.now() - 200 * dayMs,
    }),
  );
}

describe("断档文案说的就是台账里那个 0 和那个 1", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("行为：断签态下当前连续就是 0，记一次活动之后是 1，历史最长不动", () => {
    seedBrokenStreak();
    expect(getStreakBreak().broken, "夹具没构成断签态，下面的文案断言会空转").toBe(true);
    expect(getCurrentStreak()).toBe(0);
    expect(getStreakBreak().longest).toBe(12);

    touchStreak();
    expect(getCurrentStreak(), "断签后今天学一点得到的是 1，不是原来的 7").toBe(1);
    expect(readStreak().longest, "历史最长不是那把尺子，别把它当成恢复").toBe(12);
  });

  for (const locale of ["zh", "en"] as const) {
    const dict = STATS_DICTS[locale] as unknown as Record<(typeof ALL_KEYS)[number], string>;

    it(`${locale}: 三句都在扫描范围内（少一句就是门禁瞎了）`, () => {
      for (const key of ALL_KEYS) {
        expect(typeof dict[key], `「${key}」没有值`).toBe("string");
        expect(dict[key].length, `「${key}」是空串`).toBeGreaterThan(0);
      }
      expect(ALL_KEYS.length).toBe(3);
    });

    it(`${locale}: 不许许诺「原来的连续天数回来了」`, () => {
      for (const key of ALL_KEYS) {
        expect(dict[key], `「${key}」= ${dict[key]} 在许诺恢复原天数`).not.toMatch(RESUME_PROMISE[locale]);
      }
    });

    it(`${locale}: 那两句必须说出归零，并说清重数是从 1 开始`, () => {
      for (const key of STATE_KEYS) {
        expect(dict[key], `「${key}」= ${dict[key]} 没说出当下是 0`).toMatch(ZERO_SAYS[locale]);
        expect(dict[key], `「${key}」= ${dict[key]} 没说清重数是 1`).toMatch(ONE_SAYS[locale]);
      }
    });

    it(`${locale}: 正向对照——旧那三句必须被同一个禁令报出来`, () => {
      const legacy = locale === "zh"
        ? ["断档没关系，今天就能续上", "连续天数已经重新计数（历史最长 {n} 天）。", "昨天没学，连续天数重新计数了——今天学一点就接回来"]
        : ["Your streak has restarted (longest: {n} days).", "today restarts the streak. Keep going and you are back on track"];
      const missed = legacy.filter((s) => !RESUME_PROMISE[locale].test(s));
      expect(missed, `这些旧写法没被抓到：${missed.join(" / ")}`).toEqual([]);
    });
  }
});
