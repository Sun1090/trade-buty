import { describe, expect, it } from "vitest";
import { buildStreakRecovery } from "./streak-recovery";

describe("buildStreakRecovery", () => {
  it("shows gentle recovery when streak broke and today is still idle", () => {
    const result = buildStreakRecovery({
      broken: true,
      longest: 9,
      todayMinutes: 0,
      dueReviews: 3,
      hasUnfinishedChapter: true,
      locale: "zh",
    });
    expect(result.show).toBe(true);
    expect(result.reason).toBe("streak-broken-idle");
    expect(result.longest).toBe(9);
    // 优先级：到期复习 > 继续未读章节
    expect(result.actions).toEqual([
      { kind: "review", href: "/zh/review" },
      { kind: "continue", href: "/zh/path" },
    ]);
  });

  it("hides when the streak is intact (nothing to recover)", () => {
    const result = buildStreakRecovery({
      broken: false,
      longest: 5,
      todayMinutes: 0,
      dueReviews: 2,
      hasUnfinishedChapter: true,
      locale: "en",
    });
    expect(result).toMatchObject({ show: false, reason: "streak-intact", actions: [] });
  });

  it("hides once the user studied today (streak already restarted)", () => {
    const result = buildStreakRecovery({
      broken: true,
      longest: 12,
      todayMinutes: 3,
      dueReviews: 0,
      hasUnfinishedChapter: true,
      locale: "zh",
    });
    expect(result).toMatchObject({ show: false, reason: "already-active-today", actions: [] });
  });

  it("falls back to replay when no reviews are due and every chapter is finished", () => {
    const result = buildStreakRecovery({
      broken: true,
      longest: 4,
      todayMinutes: 0,
      dueReviews: 0,
      hasUnfinishedChapter: false,
      locale: "en",
    });
    expect(result.show).toBe(true);
    expect(result.actions).toEqual([
      { kind: "replay", href: "/en/replay" },
    ]);
  });

  it("skips the review action when nothing is due and caps actions at two", () => {
    const result = buildStreakRecovery({
      broken: true,
      longest: 2,
      todayMinutes: 0,
      dueReviews: 0,
      hasUnfinishedChapter: true,
      locale: "en",
    });
    expect(result.actions).toEqual([
      { kind: "continue", href: "/en/path" },
      { kind: "replay", href: "/en/replay" },
    ]);
    expect(result.actions).toHaveLength(2);
  });

  it("sanitizes corrupt inputs and localizes hrefs", () => {
    const result = buildStreakRecovery({
      broken: true,
      longest: -3,
      todayMinutes: Number.NaN,
      dueReviews: "2" as never,
      hasUnfinishedChapter: "yes" as never,
      locale: "fr",
    });
    expect(result.show).toBe(true); // broken===true 与宽松输入并存时仍给出温和引导
    expect(result.longest).toBe(0);
    // "2" 字符串可解析为 2 → 有到期复习
    expect(result.actions[0]).toEqual({ kind: "review", href: "/zh/review" });
    // hasUnfinishedChapter 非布尔 true → 不计
    expect(result.actions[1]).toEqual({ kind: "replay", href: "/zh/replay" });
  });
});
