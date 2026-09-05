import { describe, it, expect } from "vitest";
import {
  encodeQuiz,
  encodeReplay,
  encodeStreak,
  decodeQuiz,
  decodeReplay,
  decodeStreak,
  detectKind,
  buildSharePath,
  type QuizPayload,
  type ReplayPayload,
  type StreakPayload,
} from "./share-decode";

describe("share-decode round-trip", () => {
  it("quiz: encode → decode 还原", () => {
    const p: QuizPayload = {
      chapterTitle: "K 线入门",
      score: 4,
      total: 5,
      percent: 80,
      locale: "zh",
    };
    const seg = encodeQuiz(p);
    expect(seg.startsWith("v1|")).toBe(true);
    expect(decodeQuiz(seg)).toEqual(p);
  });

  it("quiz: 全对满分", () => {
    const p: QuizPayload = {
      chapterTitle: "Spot",
      score: 5,
      total: 5,
      percent: 100,
      locale: "en",
    };
    expect(decodeQuiz(encodeQuiz(p))).toEqual(p);
  });

  it("replay: encode → decode 还原", () => {
    const p: ReplayPayload = {
      symbol: "BTCUSDT",
      interval: "1h",
      correct: 7,
      total: 10,
      accuracyBps: 7000, // 70%
      bestStreak: 4,
      currentStreak: 2,
      locale: "zh",
    };
    const seg = encodeReplay(p);
    expect(decodeReplay(seg)).toEqual(p);
  });

  it("replay: 浮点准确率 87.5%", () => {
    const p: ReplayPayload = {
      symbol: "ETHUSDT",
      interval: "4h",
      correct: 7,
      total: 8,
      accuracyBps: 8750,
      bestStreak: 5,
      currentStreak: 3,
      locale: "en",
    };
    expect(decodeReplay(encodeReplay(p))).toEqual(p);
  });

  it("streak: encode → decode 还原", () => {
    const p: StreakPayload = {
      currentStreak: 7,
      longestStreak: 14,
      locale: "zh",
    };
    expect(decodeStreak(encodeStreak(p))).toEqual(p);
  });
});

describe("share-decode 非法输入", () => {
  it("空字符串 → null", () => {
    expect(decodeQuiz("")).toBeNull();
    expect(decodeReplay("")).toBeNull();
    expect(decodeStreak("")).toBeNull();
  });

  it("无版本前缀 → null", () => {
    expect(decodeQuiz("aGVsbG8")).toBeNull();
  });

  it("错误版本前缀 → null（未来兼容性）", () => {
    expect(decodeQuiz("v2|e30")).toBeNull();
  });

  it("损坏的 base64 → null", () => {
    expect(decodeQuiz("v1|!!!not-base64!!!")).toBeNull();
  });

  it("JSON 是 quiz 数据但用 decodeReplay → null（字段不匹配）", () => {
    const quizSeg = encodeQuiz({
      chapterTitle: "t",
      score: 1,
      total: 1,
      percent: 100,
      locale: "zh",
    });
    expect(decodeReplay(quizSeg)).toBeNull();
    expect(decodeStreak(quizSeg)).toBeNull();
  });

  it("JSON 是 replay 数据但用 decodeStreak → null", () => {
    const replaySeg = encodeReplay({
      symbol: "X",
      interval: "1h",
      correct: 1,
      total: 1,
      accuracyBps: 10000,
      bestStreak: 0,
      currentStreak: 0,
      locale: "en",
    });
    expect(decodeStreak(replaySeg)).toBeNull();
  });

  it("locale 不是 zh/en → null", () => {
    const bad = "v1|eyJjaGFwdGVyVGl0bGUiOiJ4Iiwic2NvcmUiOjEsInRvdGFsIjoxLCJwZXJjZW50IjoxMDAsImxvY2FsZSI6ImRlIn0";
    expect(decodeQuiz(bad)).toBeNull();
  });

  it("缺少必要字段 → null", () => {
    const bad = "v1|eyJjaGFwdGVyVGl0bGUiOiJ4Iiwic2NvcmUiOjF9";
    expect(decodeQuiz(bad)).toBeNull();
  });

  it("null / 非字符串 → null", () => {
    expect(decodeQuiz(null as unknown as string)).toBeNull();
    expect(decodeQuiz(undefined as unknown as string)).toBeNull();
  });
});

describe("detectKind", () => {
  it("quiz segment → 'quiz'", () => {
    const seg = encodeQuiz({
      chapterTitle: "a",
      score: 1,
      total: 1,
      percent: 100,
      locale: "zh",
    });
    expect(detectKind(seg)).toBe("quiz");
  });

  it("replay segment → 'replay'", () => {
    const seg = encodeReplay({
      symbol: "X",
      interval: "1h",
      correct: 1,
      total: 1,
      accuracyBps: 10000,
      bestStreak: 0,
      currentStreak: 0,
      locale: "en",
    });
    expect(detectKind(seg)).toBe("replay");
  });

  it("streak segment → 'streak'", () => {
    const seg = encodeStreak({ currentStreak: 1, longestStreak: 1, locale: "zh" });
    expect(detectKind(seg)).toBe("streak");
  });

  it("非法 segment → null", () => {
    expect(detectKind("garbage")).toBeNull();
    expect(detectKind("")).toBeNull();
  });
});

describe("buildSharePath", () => {
  it("quiz 路径以 /share/quiz/ 开头", () => {
    const path = buildSharePath("quiz", {
      chapterTitle: "a",
      score: 1,
      total: 1,
      percent: 100,
      locale: "zh",
    });
    expect(path.startsWith("/share/quiz/v1|")).toBe(true);
  });

  it("replay 路径以 /share/replay/ 开头", () => {
    const path = buildSharePath("replay", {
      symbol: "BTCUSDT",
      interval: "1h",
      correct: 1,
      total: 1,
      accuracyBps: 10000,
      bestStreak: 0,
      currentStreak: 0,
      locale: "en",
    });
    expect(path.startsWith("/share/replay/v1|")).toBe(true);
  });

  it("streak 路径以 /share/streak/ 开头", () => {
    const path = buildSharePath("streak", {
      currentStreak: 5,
      longestStreak: 10,
      locale: "zh",
    });
    expect(path.startsWith("/share/streak/v1|")).toBe(true);
  });

  it("path 不含 + / = 字符（URL-safe）", () => {
    const path = buildSharePath("quiz", {
      chapterTitle: "K 线入门 + / 高级 = 🎉",
      score: 3,
      total: 5,
      percent: 60,
      locale: "zh",
    });
    const segment = path.split("/").pop() ?? "";
    // v1| 是版本前缀（| 是我们自定义的分隔符），剥掉后 b64url 部分必须 URL-safe
    const b64 = segment.slice(segment.indexOf("|") + 1);
    expect(b64).not.toMatch(/[+/=]/);
    expect(b64).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
