import { describe, it, expect, vi } from "vitest";
import Image, { size, contentType } from "./opengraph-image";
import { encodeQuiz } from "@/lib/share-decode";

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
});
