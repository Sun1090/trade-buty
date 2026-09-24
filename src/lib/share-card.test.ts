import { describe, it, expect } from "vitest";
import {
  CARD_SIZE,
  COLORS_DARK,
  COLORS_LIGHT,
  colorsFor,
  formatPercent,
  gradeColor,
  gradeFromPercent,
  gradeWord,
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

// 落地页的 `<title>`/OG 与页面上的 `<h1>` 都从这里取措辞：两处各写一份时，
// 同一轮成绩会在搜索结果和页面之间对不上号。
describe("gradeWord", () => {
  it("中文把字母换成词，测验与回放的措辞不同", () => {
    expect(gradeWord("S", "quiz", "zh")).toBe("满分");
    expect(gradeWord("A", "quiz", "zh")).toBe("优秀");
    expect(gradeWord("B", "quiz", "zh")).toBe("及格");
    expect(gradeWord("C", "quiz", "zh")).toBe("待加强");
    expect(gradeWord("S", "replay", "zh")).toBe("卓越");
    expect(gradeWord("A", "replay", "zh")).toBe("稳健");
    expect(gradeWord("B", "replay", "zh")).toBe("及格");
    expect(gradeWord("C", "replay", "zh")).toBe("待加强");
  });

  it("英文保留字母（`Grade A` 本来就读得通）", () => {
    for (const card of ["quiz", "replay"] as const) {
      for (const grade of ["S", "A", "B", "C"] as const) {
        expect(gradeWord(grade, card, "en")).toBe(grade);
      }
    }
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
// ── R13.1 分享卡视觉模板统一 ─────────────────────────────
describe("CARD_LAYOUT template skeleton (R13.1)", () => {
  it("anchors stay inside the card and in a sane top-to-bottom order", async () => {
    const { CARD_LAYOUT } = await import("./share-card");
    expect(CARD_LAYOUT.headingY).toBe(90);
    expect(CARD_LAYOUT.metaY).toBe(160);
    expect(CARD_LAYOUT.heroCenterYFrac).toBeGreaterThan(0);
    expect(CARD_LAYOUT.heroCenterYFrac).toBeLessThan(1);
    expect(CARD_LAYOUT.metricLineYFrac).toBeGreaterThan(CARD_LAYOUT.heroCenterYFrac);
    expect(CARD_LAYOUT.metricLineYFrac).toBeLessThan(1);
    expect(CARD_LAYOUT.footerPadX).toBeGreaterThan(0);
    expect(CARD_LAYOUT.headingFontSize).toBeLessThan(CARD_LAYOUT.metaFontSize);
    expect(CARD_LAYOUT.heroFontSizeMax).toBeGreaterThan(CARD_LAYOUT.metricFontSize);
  });

  it("drawCardHeading, drawHeroValue and drawCardMetricLine paint at the unified anchors", async () => {
    const { CARD_LAYOUT, drawCardHeading, drawHeroValue, drawCardMetricLine, colorsFor } = await import("./share-card");
    const calls: { text: string; x: number; y: number }[] = [];
    const ctx = {
      save: () => {}, restore: () => {},
      fillText: (text: string, x: number, y: number) => calls.push({ text, x, y }),
      fillStyle: "", font: "", textAlign: "", textBaseline: "",
    } as unknown as CanvasRenderingContext2D;
    const colors = colorsFor("dark");
    drawCardHeading(ctx, 1080, colors, "system-ui", "测试标题");
    drawHeroValue(ctx, 1080, 1080, "system-ui", { text: "S", color: "#fff", size: 420 });
    drawCardMetricLine(ctx, 1080, 1080, colors, "system-ui", "3/10");
    expect(calls[0]).toEqual({ text: "测试标题", x: 540, y: CARD_LAYOUT.headingY });
    expect(calls[1]).toEqual({ text: "S", x: 540, y: Math.round(1080 * CARD_LAYOUT.heroCenterYFrac) });
    expect(calls[2]).toEqual({ text: "3/10", x: 540, y: Math.round(1080 * CARD_LAYOUT.metricLineYFrac) });
  });

  it("drawHeroValue clamps oversized fonts to the template max", async () => {
    const { CARD_LAYOUT, drawHeroValue } = await import("./share-card");
    let recordedFont = "";
    const ctx = {
      save: () => {}, restore: () => {}, fillText: () => {},
      set font(v: string) { recordedFont = v; },
      fillStyle: "", textAlign: "", textBaseline: "",
    } as unknown as CanvasRenderingContext2D;
    drawHeroValue(ctx, 1080, 1080, "system-ui", { text: "999", color: "#fff", size: 9999 });
    expect(recordedFont).toContain(`${CARD_LAYOUT.heroFontSizeMax}px`);
  });
});

import { drawQuizCard, drawReplayCard, drawStreakCard } from "./share-card";

function makeCanvasContext() {
  const calls: { name: string; args: unknown[] }[] = [];
  const track = (name: string) => (...args: unknown[]) => calls.push({ name, args });
  const gradient = { addColorStop: track("gradient.addColorStop") };
  return {
    calls,
    ctx: {
      save: track("save"),
      restore: track("restore"),
      beginPath: track("beginPath"),
      moveTo: track("moveTo"),
      lineTo: track("lineTo"),
      stroke: track("stroke"),
      fillRect: track("fillRect"),
      strokeRect: track("strokeRect"),
      fillText: track("fillText"),
      createLinearGradient: track("createLinearGradient"),
      measureText: () => ({ width: 10 }),
      set fillStyle(_value: string | CanvasGradient | CanvasPattern) {},
      set strokeStyle(_value: string | CanvasGradient | CanvasPattern) {},
      set lineWidth(_value: number) {},
      set font(_value: string) {},
      set textAlign(_value: CanvasTextAlign) {},
      set textBaseline(_value: CanvasTextBaseline) {},
    } as unknown as CanvasRenderingContext2D,
    // make createLinearGradient return a gradient-like object after recording the call
    withGradient(ctx: CanvasRenderingContext2D) {
      ctx.createLinearGradient = (() => {
        calls.push({ name: "createLinearGradient", args: [0, 0, 1080, 1080] });
        return gradient;
      }) as CanvasRenderingContext2D["createLinearGradient"];
    },
  };
}

function textCalls(ctx: ReturnType<typeof makeCanvasContext>) {
  return ctx.calls.filter((call) => call.name === "fillText").map((call) => call.args[0]);
}

describe("share card drawing entrypoints", () => {
  it("draws the bilingual quiz result card and its brand footer", () => {
    const mock = makeCanvasContext();
    const ctx = mock.ctx;
    mock.withGradient(ctx);

    drawQuizCard({
      ctx,
      width: 1080,
      height: 1080,
      chapterTitle: "入门基础",
      score: 10,
      total: 10,
      percent: 100,
      locale: "zh",
      theme: "dark",
      siteName: "Trade Buty",
      font: "system-ui",
    });

    expect(textCalls(mock)).toContain("随堂测成绩");
    expect(textCalls(mock)).toContain("入门基础");
    expect(textCalls(mock)).toContain("S");
    expect(textCalls(mock)).toContain("10/10");
    expect(textCalls(mock)).toContain("100%");
    expect(textCalls(mock)).toContain("Trade Buty");
  });

  it("draws replay accuracy, streak blocks, and the English card copy", () => {
    const mock = makeCanvasContext();
    const ctx = mock.ctx;
    mock.withGradient(ctx);

    drawReplayCard({
      ctx,
      width: 1080,
      height: 1080,
      symbol: "BTCUSDT",
      interval: "1h",
      correct: 8,
      total: 10,
      accuracy: 0.8,
      bestStreak: 5,
      currentStreak: 3,
      locale: "en",
      theme: "light",
      siteName: "Trade Buty",
      font: "system-ui",
    });

    expect(textCalls(mock)).toContain("Replay Result");
    expect(textCalls(mock)).toContain("BTCUSDT · 1h");
    expect(textCalls(mock)).toContain("S");
    expect(textCalls(mock)).toContain("80%");
    expect(textCalls(mock)).toContain("8/10 correct");
    expect(textCalls(mock)).toContain("3");
    expect(textCalls(mock)).toContain("Best streak");
    expect(textCalls(mock)).toContain("5");
  });

  const streakArgs = (recentDays: { date: string; active: boolean }[]) => ({
    width: 1080,
    height: 1080,
    currentStreak: 12,
    longestStreak: 12,
    recentDays,
    locale: "zh",
    theme: "dark",
    siteName: "Trade Buty",
    font: "system-ui",
  } as const);

  const SEVEN_DAYS = [
    { date: "2026-09-16", active: true },
    { date: "2026-09-17", active: false },
    { date: "2026-09-18", active: true },
    { date: "2026-09-19", active: true },
    { date: "2026-09-20", active: false },
    { date: "2026-09-21", active: true },
    { date: "2026-09-22", active: true },
  ];

  it("有 7 天数据时画日历：7 个方格 + 7 个日期标签 + 「近 7 天」", () => {
    const mock = makeCanvasContext();
    mock.withGradient(mock.ctx);
    drawStreakCard({ ctx: mock.ctx, ...streakArgs(SEVEN_DAYS) });

    // 方格都落在 y = height - 280 = 800 这一行
    const cells = mock.calls.filter((c) => c.name === "fillRect" && c.args[1] === 800);
    expect(cells).toHaveLength(7);
    expect(textCalls(mock)).toContain("学习连续打卡");
    expect(textCalls(mock)).toContain("近 7 天");
    expect(textCalls(mock)).toContain("09-16");
    expect(textCalls(mock)).toContain("09-22");
  });

  it("没有 7 天数据（落地页只带 streak 两个数）→ 不画空日历，也不写「近 7 天」", () => {
    const mock = makeCanvasContext();
    mock.withGradient(mock.ctx);
    drawStreakCard({ ctx: mock.ctx, ...streakArgs([]) });

    const texts = textCalls(mock);
    expect(texts).not.toContain("近 7 天");
    expect(texts).not.toContain("Last 7 days");
    // 一行都不画：日历那一行（y=800）上没有方格
    expect(mock.calls.filter((c) => c.name === "fillRect" && c.args[1] === 800)).toHaveLength(0);
    // 卡片本身照常：连续天数与品牌行仍在
    expect(texts).toContain("12");
    expect(texts).toContain("最长连胜：12 天");
    expect(texts).toContain("Trade Buty");
  });

  it("英文卡在无数据时同样不写「Last 7 days」", () => {
    const mock = makeCanvasContext();
    mock.withGradient(mock.ctx);
    drawStreakCard({
      ctx: mock.ctx,
      ...streakArgs([]),
      locale: "en",
    });
    expect(textCalls(mock)).not.toContain("Last 7 days");
  });
});
