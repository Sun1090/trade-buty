/**
 * R8.4 分享落地页单元测试。
 *
 * 早期版本把 page.tsx 的逻辑「复制」到测试里再断言，等于测试自己的副本 ——
 * 页面真实分支（尤其是 percent 解码）从来没被覆盖过。现在直接测纯逻辑模块
 * `@/lib/share-landing`，页面只做路由壳。
 *
 * 重点回归：路由动态段给到 page 的是**编码形态**的 path（`v1%7C...`），
 * 而 generateMetadata 拿到已解码的形态。`resolveShareLanding` 必须两种都接受，
 * 否则分享链接会 404（线上真实事故）。
 */
import { describe, it, expect } from "vitest";
import { encodeQuiz, encodeReplay, encodeStreak, detectKind } from "@/lib/share-decode";
import {
  normalizeShareSegment,
  resolveShareLanding,
  isShareKind,
  summarizeForMeta,
  kindToLocale,
} from "@/lib/share-landing";

describe("normalizeShareSegment", () => {
  it("解码 percent-encoded 段", () => {
    expect(normalizeShareSegment("v1%7CeyJhIjoxfQ")).toBe("v1|eyJhIjoxfQ");
  });

  it("对已解码的段幂等", () => {
    expect(normalizeShareSegment("v1|eyJhIjoxfQ")).toBe("v1|eyJhIjoxfQ");
  });

  it("畸形 percent 序列返回 null 而不是抛错", () => {
    expect(normalizeShareSegment("v1%7C%")).toBeNull();
    expect(normalizeShareSegment("%E0%A4%A")).toBeNull();
  });
});

describe("resolveShareLanding", () => {
  it("编码形态的 quiz 段能解析（回归：page 与 generateMetadata 解码不一致）", () => {
    const segment = encodeQuiz({
      chapterTitle: "01 · 入门",
      score: 8,
      total: 10,
      percent: 80,
      locale: "zh",
    });
    // 前提：编码形态本身送进 detectKind 是解析不出来的 —— 这正是线上事故
    expect(detectKind(encodeURIComponent(segment))).toBeNull();

    const resolved = resolveShareLanding("quiz", encodeURIComponent(segment));
    expect(resolved).not.toBeNull();
    expect(resolved?.kind).toBe("quiz");
    expect(resolved?.path).toBe(segment);
    expect(resolved?.locale).toBe("zh");
    expect(resolved?.title).toContain("01 · 入门");
    expect(resolved?.title).toContain("8/10");
  });

  it("已解码形态同样能解析", () => {
    const segment = encodeQuiz({
      chapterTitle: "Spot",
      score: 5,
      total: 5,
      percent: 100,
      locale: "en",
    });
    const resolved = resolveShareLanding("quiz", segment);
    expect(resolved?.locale).toBe("en");
    expect(resolved?.path).toBe(segment);
  });

  it("replay 编码形态解析出对应语言", () => {
    const segment = encodeReplay({
      symbol: "BTCUSDT",
      interval: "1h",
      correct: 7,
      total: 10,
      accuracyBps: 7000,
      bestStreak: 5,
      currentStreak: 3,
      locale: "en",
    });
    const resolved = resolveShareLanding("replay", encodeURIComponent(segment));
    expect(resolved?.locale).toBe("en");
    expect(resolved?.title).toContain("BTCUSDT");
  });

  it("streak 编码形态解析", () => {
    const segment = encodeStreak({ currentStreak: 12, longestStreak: 30, locale: "zh" });
    const resolved = resolveShareLanding("streak", encodeURIComponent(segment));
    expect(resolved?.locale).toBe("zh");
    expect(resolved?.title).toContain("12");
  });

  it("未知 kind → null", () => {
    expect(resolveShareLanding("garbage", "v1|x")).toBeNull();
  });

  it("kind 与载荷类型不符 → null", () => {
    const quizSegment = encodeQuiz({
      chapterTitle: "x",
      score: 1,
      total: 1,
      percent: 100,
      locale: "zh",
    });
    expect(resolveShareLanding("streak", quizSegment)).toBeNull();
    expect(resolveShareLanding("quiz", quizSegment)).not.toBeNull();
  });

  it("畸形 percent 序列 → null（不抛 500）", () => {
    expect(resolveShareLanding("quiz", "v1%7C%")).toBeNull();
  });

  it("乱写的段 → null", () => {
    expect(resolveShareLanding("quiz", "garbage-no-prefix")).toBeNull();
  });
});

describe("isShareKind", () => {
  it("只认三种 kind", () => {
    expect(isShareKind("quiz")).toBe(true);
    expect(isShareKind("replay")).toBe(true);
    expect(isShareKind("streak")).toBe(true);
    expect(isShareKind("garbage")).toBe(false);
  });
});

describe("kindToLocale / summarizeForMeta", () => {
  it("非法载荷回退默认语言", () => {
    expect(kindToLocale("quiz", "garbage")).toBeDefined();
    expect(summarizeForMeta("quiz", "garbage").title).toBeTruthy();
  });
});

describe("kindToLocale 覆盖三种载荷", () => {
  it("replay 载荷解析出语言", () => {
    const seg = encodeReplay({
      symbol: "ETHUSDT",
      interval: "4h",
      correct: 3,
      total: 5,
      accuracyBps: 6000,
      bestStreak: 2,
      currentStreak: 1,
      locale: "en",
    });
    expect(kindToLocale("replay", seg)).toBe("en");
  });

  it("streak 载荷解析出语言", () => {
    const seg = encodeStreak({ currentStreak: 1, longestStreak: 2, locale: "zh" });
    expect(kindToLocale("streak", seg)).toBe("zh");
  });
});

describe("gradeLabel 分级覆盖", () => {
  function quizTitle(percent: number) {
    return summarizeForMeta(
      "quiz",
      encodeQuiz({ chapterTitle: "C", score: 7, total: 10, percent, locale: "zh" }),
    ).title;
  }

  it("60-79 分显示及格", () => {
    expect(quizTitle(70)).toContain("及格");
  });

  it("低于 60 分显示待加强", () => {
    expect(quizTitle(50)).toContain("待加强");
  });

  it("英文 60-79 显示 B", () => {
    const title = summarizeForMeta(
      "quiz",
      encodeQuiz({ chapterTitle: "C", score: 7, total: 10, percent: 70, locale: "en" }),
    ).title;
    expect(title).toContain("B");
  });
});

describe("replayGradeLabel 分级覆盖", () => {
  function replayTitle(accuracyBps: number, total = 10, locale: "zh" | "en" = "zh") {
    return summarizeForMeta(
      "replay",
      encodeReplay({
        symbol: "BTCUSDT",
        interval: "1h",
        correct: 6,
        total,
        accuracyBps,
        bestStreak: 3,
        currentStreak: 1,
        locale,
      }),
    ).title;
  }

  it("总题数不足 3 判为待加强", () => {
    expect(replayTitle(9000, 2)).toContain("待加强");
  });

  it("准确率 >=70% 显示卓越", () => {
    expect(replayTitle(8000)).toContain("卓越");
  });

  it("准确率 60-69% 显示稳健", () => {
    expect(replayTitle(6500)).toContain("稳健");
  });

  it("准确率 50-59% 显示及格", () => {
    expect(replayTitle(5500)).toContain("及格");
  });

  it("准确率低于 50% 显示待加强", () => {
    expect(replayTitle(4000)).toContain("待加强");
  });

  it("英文准确率 60-69% 显示 A", () => {
    expect(replayTitle(6500, 10, "en")).toContain("A");
  });
});
