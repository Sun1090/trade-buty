/**
 * 断档恢复卡那句「今天学一点就重新开始计数」曾经写的是「完成一件 5 分钟的小事」。
 * 连续天数不看时长：`touchStreak()` 由记录学习活动的地方调用（`src/lib/progress.ts:87`、
 * `src/lib/progress-helpers.ts:5`、`src/lib/wrongbook.ts`），读完一课、复习一道错题都算，
 * 10 秒也算。写一个分钟门槛等于凭空立一条比真实规则更严的规矩——只学了两分钟的人会
 * 以为自己的连续天数仍然没救回来。这里禁掉这一类时间阈值，数字只允许是代入值 `{n}`。
 */
import { describe, expect, it } from "vitest";
import { STATS_DICTS } from "./i18n-stats";

/** 从渲染出的文案里去掉代入占位符，剩下的数字才是「系统在承诺什么」 */
const stripPlaceholders = (text: string) => text.replace(/\{[a-zA-Z]+\}/g, "");

/**
 * 注意不要用 `\b` 收尾：中文不是 `\w`，「5 分钟」后面接「的」根本不构成词边界，
 * 加了 `\b` 的正则对中文静默失效（本条第一次就是这样假绿的）。英文侧改用
 * 「后面不能再跟拉丁字母」的负向前行断言，并允许 `5-minute` 这种连字符写法。
 */
const TIME_THRESHOLD =
  /\d+[\s-]*(分钟|秒|小时|天|周|(minute|second|hour|day|week)s?(?![a-z]))/i;
/** 旧文案：禁令必须证明它抓得住这一类 */
const LEGACY = [
  "连续天数已经重新计数（历史最长 {n} 天）。今天完成一件 5 分钟的小事，就算重新开始。",
  "Your streak has restarted (longest: {n} days). Finish one small 5-minute task today and you are back on track.",
];

describe("断档恢复文案不立时间门槛", () => {
  it("禁令抓得住旧文案", () => {
    for (const sample of LEGACY) {
      expect(TIME_THRESHOLD.test(stripPlaceholders(sample)), `抓不住：${sample}`).toBe(
        true,
      );
    }
  });

  it("两种语言的连续天数相关文案里没有任何裸时间数字", () => {
    let checked = 0;
    for (const locale of ["zh", "en"] as const) {
      const dict = STATS_DICTS[locale] as unknown as Record<string, string>;
      for (const [key, value] of Object.entries(dict)) {
        if (!/streak|recovery/i.test(key) || typeof value !== "string") continue;
        checked += 1;
        expect(
          TIME_THRESHOLD.test(stripPlaceholders(value)),
          `${locale}.${key} 写了一个时间门槛：${value}`,
        ).toBe(false);
      }
    }
    expect(checked, "一条都没扫到，说明键名匹配已经失效").toBeGreaterThan(8);
  });

  it("占位符仍然是代入值，不是编出来的数", () => {
    for (const locale of ["zh", "en"] as const) {
      const dict = STATS_DICTS[locale] as unknown as Record<string, string>;
      expect(dict.recoveryBodyTpl).toContain("{n}");
      expect(dict.recoveryReviewTpl).toContain("{n}");
      expect(dict.streakReassureTpl).toContain("{n}");
    }
  });
});
