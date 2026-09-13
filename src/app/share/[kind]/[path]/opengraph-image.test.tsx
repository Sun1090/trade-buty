import { describe, it, expect, vi } from "vitest";
import Image, { summarize, size, contentType } from "./opengraph-image";
import {
  encodeQuiz,
  encodeReplay,
  encodeStreak,
} from "@/lib/share-decode";

describe("share OG image with error degradation (R13.5)", () => {
  it("exports the social card dimensions and png content type", () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe("image/png");
  });

  it("renders an ImageResponse for a valid quiz payload", async () => {
    vi.stubEnv("OG_TEST", "1");
    const valid = encodeQuiz({ chapterTitle: "入门基础", score: 8, total: 10, percent: 80, locale: "zh" });
    const res = await Image({ params: Promise.resolve({ kind: "quiz", path: valid }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("image/png");
  });

  it("degrades to a brand card for unknown kinds, garbage paths and absurd payloads — never throws", async () => {
    const cases = [
      { kind: "evil", path: "whatever" },
      { kind: "quiz", path: "!!!not-base64!!!" },
      { kind: "quiz", path: "v1|bm90LWpzb24" }, // base64('not-json') 解码失败
      // total=0 走错误降级（之后绘制除零会炸）
      { kind: "quiz", path: encodeQuiz({ chapterTitle: "x", score: 1, total: 0, percent: 50, locale: "zh" }) },
    ];
    for (const c of cases) {
      const res = await Image({ params: Promise.resolve(c) });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("image/png");
    }
  });

  it("params 解包失败或 path 含非法百分号编码时也降级为品牌卡", async () => {
    const reject = await Image({ params: Promise.reject(new Error("bad params")) });
    expect(reject.status).toBe(200);

    // decodeURIComponent("%") 抛 URIError → 必须被 catch 抓住
    const badEncoding = await Image({ params: Promise.resolve({ kind: "quiz", path: "%" }) });
    expect(badEncoding.status).toBe(200);
    expect(badEncoding.headers.get("Content-Type")).toContain("image/png");
  });

  it("每个 kind 都能渲染出图片响应", async () => {
    const payloads = [
      { kind: "quiz", path: encodeQuiz({ chapterTitle: "t", score: 3, total: 3, percent: 100, locale: "en" }) },
      {
        kind: "replay",
        path: encodeReplay({
          symbol: "BTCUSDT", interval: "1h", correct: 7, total: 10,
          accuracyBps: 7000, bestStreak: 4, currentStreak: 2, locale: "zh",
        }),
      },
      { kind: "streak", path: encodeStreak({ currentStreak: 30, longestStreak: 42, locale: "zh" }) },
    ];
    for (const c of payloads) {
      const res = await Image({ params: Promise.resolve(c) });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("image/png");
    }
  });
});

describe("summarize 白名单取值", () => {
  it("quiz：按百分比映射等级，并按 locale 切换标题", () => {
    const s = summarize(
      "quiz",
      encodeQuiz({ chapterTitle: "入门基础", score: 8, total: 10, percent: 80, locale: "zh" }),
    );
    expect(s).toMatchObject({ heading: "随堂测成绩", grade: "A", gradeColor: "#34d399", metric: "8/10" });
    expect(s?.subline).toBe("入门基础");

    const en = summarize(
      "quiz",
      encodeQuiz({ chapterTitle: "Basics", score: 10, total: 10, percent: 100, locale: "en" }),
    );
    expect(en).toMatchObject({ heading: "Quiz Result", grade: "S", gradeColor: "#fbbf24", metric: "10/10" });
  });

  it("quiz：章节标题截断到 28 个字符，避免溢出卡片", () => {
    const long = "字".repeat(60);
    const s = summarize("quiz", encodeQuiz({ chapterTitle: long, score: 1, total: 2, percent: 50, locale: "zh" }));
    expect(s?.subline).toHaveLength(28);
  });

  it("quiz：total=0 视为无效返回 null", () => {
    expect(
      summarize("quiz", encodeQuiz({ chapterTitle: "x", score: 0, total: 0, percent: 0, locale: "zh" })),
    ).toBeNull();
  });

  it("replay：等级来自准确率，指标是百分比，副标题是交易对·周期", () => {
    const s = summarize(
      "replay",
      encodeReplay({
        symbol: "ETHUSDT", interval: "4h", correct: 7, total: 10,
        accuracyBps: 7000, bestStreak: 4, currentStreak: 1, locale: "zh",
      }),
    );
    expect(s).toMatchObject({ heading: "回放战绩", grade: "S", metric: "70%", subline: "ETHUSDT · 4h" });
  });

  it("replay：样本不足 3 次时降为 C（不给小样本贴 S）", () => {
    const s = summarize(
      "replay",
      encodeReplay({
        symbol: "BTCUSDT", interval: "1h", correct: 2, total: 2,
        accuracyBps: 10000, bestStreak: 2, currentStreak: 2, locale: "zh",
      }),
    );
    expect(s?.grade).toBe("C");
  });

  it("replay：total=0 返回 null", () => {
    expect(
      summarize(
        "replay",
        encodeReplay({
          symbol: "BTCUSDT", interval: "1h", correct: 0, total: 0,
          accuracyBps: 0, bestStreak: 0, currentStreak: 0, locale: "zh",
        }),
      ),
    ).toBeNull();
  });

  it("streak：按天数给等级与文案", () => {
    const zh = summarize("streak", encodeStreak({ currentStreak: 30, longestStreak: 42, locale: "zh" }));
    expect(zh).toMatchObject({ heading: "学习连续打卡", grade: "S", metric: "30 天 · 最长 42 天" });
    expect(zh?.subline).toBe("每天都在进步");

    const en = summarize("streak", encodeStreak({ currentStreak: 7, longestStreak: 9, locale: "en" }));
    expect(en).toMatchObject({ heading: "Study streak", grade: "B", metric: "7 days · best 9" });
    expect(en?.subline).toBe("Every day counts");
  });

  it("streak：currentStreak=0 返回 null", () => {
    expect(summarize("streak", encodeStreak({ currentStreak: 0, longestStreak: 5, locale: "zh" }))).toBeNull();
  });

  it("无法解码的 path 一律返回 null", () => {
    expect(summarize("quiz", "garbage")).toBeNull();
    expect(summarize("replay", "garbage")).toBeNull();
    expect(summarize("streak", "garbage")).toBeNull();
  });
});
