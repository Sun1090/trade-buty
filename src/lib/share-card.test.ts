import { describe, it, expect } from "vitest";
import {
  CARD_SIZE,
  COLORS_DARK,
  COLORS_LIGHT,
  colorsFor,
  formatPercent,
  gradeColor,
  gradeFromPercent,
  truncateForCanvas,
  wrapText,
} from "./share-card";

describe("CARD_SIZE", () => {
  it("默认 1080（OG/社交正方形标准）", () => {
    expect(CARD_SIZE).toBe(1080);
  });
});

describe("colorsFor", () => {
  it("dark → COLORS_DARK", () => {
    expect(colorsFor("dark")).toBe(COLORS_DARK);
  });
  it("light → COLORS_LIGHT", () => {
    expect(colorsFor("light")).toBe(COLORS_LIGHT);
  });
});

describe("gradeFromPercent", () => {
  it("100 → S（满分）", () => {
    expect(gradeFromPercent(100)).toBe("S");
  });
  it("99.5 → A（不到 100 不算 S）", () => {
    expect(gradeFromPercent(99.5)).toBe("A");
  });
  it("87.5 → A（80–99）", () => {
    expect(gradeFromPercent(87.5)).toBe("A");
  });
  it("80 → A（边界）", () => {
    expect(gradeFromPercent(80)).toBe("A");
  });
  it("75 → B（60–79）", () => {
    expect(gradeFromPercent(75)).toBe("B");
  });
  it("60 → B（边界）", () => {
    expect(gradeFromPercent(60)).toBe("B");
  });
  it("59 → C", () => {
    expect(gradeFromPercent(59)).toBe("C");
  });
  it("0 → C", () => {
    expect(gradeFromPercent(0)).toBe("C");
  });
  it("负数 → C（异常输入兜底）", () => {
    expect(gradeFromPercent(-1)).toBe("C");
  });
  it("NaN → C", () => {
    expect(gradeFromPercent(Number.NaN)).toBe("C");
  });
});

describe("gradeColor", () => {
  it("S 用金色（与站点主色区分、突出满分奖励）", () => {
    const c = gradeColor("S", COLORS_DARK);
    expect(c).toBe("#fbbf24");
  });
  it("A 用 accentStrong", () => {
    expect(gradeColor("A", COLORS_DARK)).toBe(COLORS_DARK.accentStrong);
    expect(gradeColor("A", COLORS_LIGHT)).toBe(COLORS_LIGHT.accentStrong);
  });
  it("B 用 accent", () => {
    expect(gradeColor("B", COLORS_DARK)).toBe(COLORS_DARK.accent);
    expect(gradeColor("B", COLORS_LIGHT)).toBe(COLORS_LIGHT.accent);
  });
  it("C 用 fgMuted（不抢镜，提示不佳）", () => {
    expect(gradeColor("C", COLORS_DARK)).toBe(COLORS_DARK.fgMuted);
  });
});

describe("truncateForCanvas", () => {
  it("不超长 → 原样", () => {
    expect(truncateForCanvas("入门基础", 10)).toBe("入门基础");
  });
  it("超长 → 加省略号", () => {
    expect(truncateForCanvas("入门基础非常长的标题", 5)).toBe("入门基础…");
  });
  it("空字符串 → 空字符串", () => {
    expect(truncateForCanvas("", 5)).toBe("");
  });
  it("恰好等于 maxChars → 不加省略号", () => {
    expect(truncateForCanvas("12345", 5)).toBe("12345");
  });
});

describe("formatPercent", () => {
  it("整数 → 整数 %", () => {
    expect(formatPercent(87)).toBe("87%");
  });
  it("小数四舍五入", () => {
    expect(formatPercent(87.5)).toBe("88%");
    expect(formatPercent(87.4)).toBe("87%");
  });
  it("100 不溢出", () => {
    expect(formatPercent(100)).toBe("100%");
  });
});

describe("wrapText", () => {
  // 假 ctx：measureText 固定宽度策略：每 5 个 ASCII 字符算 100px，CJK 单字 50px
  function mockCtx(charWidth = 10, cjkWidth = 25): CanvasRenderingContext2D {
    return {
      measureText(text: string): TextMetrics {
        let w = 0;
        for (const ch of text) {
          w += ch.charCodeAt(0) > 127 ? cjkWidth : charWidth;
        }
        return { width: w } as TextMetrics;
      },
    } as unknown as CanvasRenderingContext2D;
  }
  it("短串 → 1 行", () => {
    const lines = wrapText(mockCtx(), "hello", 100);
    expect(lines).toEqual(["hello"]);
  });
  it("长串换行", () => {
    const lines = wrapText(mockCtx(), "abcdefghijklmnopqrst", 50);
    // 5 chars/50px → 10 chars max → "abcdefghij" (50px) + "klmnopqrst" (still fits, 50px) ⇒ 1 line?
    // 实际算法：buf="a"→"ab"→…"abcdefghij" (50px), next char "k" -> next="abcdefghijk" (60px) > 50 push "abcdefghij", buf="k"
    // "klmnopqrst" (50px) push → ["abcdefghij", "klmnopqrst"]
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
  it("空串 → 空数组", () => {
    expect(wrapText(mockCtx(), "", 100)).toEqual([]);
  });
});

import { gradeFromReplayAccuracy } from "./share-card";

describe("gradeFromReplayAccuracy", () => {
  it("100% → S", () => {
    expect(gradeFromReplayAccuracy(1.0, 10)).toBe("S");
  });
  it("70% 边界 → S", () => {
    expect(gradeFromReplayAccuracy(0.7, 10)).toBe("S");
  });
  it("69.9% → A", () => {
    expect(gradeFromReplayAccuracy(0.699, 10)).toBe("A");
  });
  it("60% 边界 → A", () => {
    expect(gradeFromReplayAccuracy(0.6, 10)).toBe("A");
  });
  it("50% 边界 → B", () => {
    expect(gradeFromReplayAccuracy(0.5, 10)).toBe("B");
  });
  it("49% → C", () => {
    expect(gradeFromReplayAccuracy(0.49, 10)).toBe("C");
  });
  it("猜测次数 < 3 → C（样本不足不能给评级）", () => {
    expect(gradeFromReplayAccuracy(1.0, 2)).toBe("C");
    expect(gradeFromReplayAccuracy(0.8, 1)).toBe("C");
  });
  it("0 次 → C", () => {
    expect(gradeFromReplayAccuracy(0, 0)).toBe("C");
  });
  it("负数 → C", () => {
    expect(gradeFromReplayAccuracy(-0.5, 10)).toBe("C");
  });
  it("NaN → C", () => {
    expect(gradeFromReplayAccuracy(Number.NaN, 10)).toBe("C");
  });
});
import { gradeFromStreakDays } from "./share-card";

describe("gradeFromStreakDays", () => {
  it("0 → none（无学习）", () => {
    expect(gradeFromStreakDays(0)).toBe("none");
  });
  it("1 → C（刚刚起步）", () => {
    expect(gradeFromStreakDays(1)).toBe("C");
  });
  it("6 → C", () => {
    expect(gradeFromStreakDays(6)).toBe("C");
  });
  it("7 边界 → B（一周坚持）", () => {
    expect(gradeFromStreakDays(7)).toBe("B");
  });
  it("13 → B", () => {
    expect(gradeFromStreakDays(13)).toBe("B");
  });
  it("14 边界 → A", () => {
    expect(gradeFromStreakDays(14)).toBe("A");
  });
  it("29 → A", () => {
    expect(gradeFromStreakDays(29)).toBe("A");
  });
  it("30 边界 → S（月度王者）", () => {
    expect(gradeFromStreakDays(30)).toBe("S");
  });
  it("100 → S", () => {
    expect(gradeFromStreakDays(100)).toBe("S");
  });
  it("负数 → none", () => {
    expect(gradeFromStreakDays(-1)).toBe("none");
  });
  it("NaN → none", () => {
    expect(gradeFromStreakDays(Number.NaN)).toBe("none");
  });
});