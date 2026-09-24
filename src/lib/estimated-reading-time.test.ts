import { describe, expect, it } from "vitest";
import { estimateReadingMinutes } from "./estimated-reading-time";

describe("estimateReadingMinutes", () => {
  it("returns zero for empty content", () => {
    expect(estimateReadingMinutes("")).toBe(0);
    expect(estimateReadingMinutes("   \n")).toBe(0);
  });

  it("rounds Chinese prose at 300 characters per minute", () => {
    expect(estimateReadingMinutes("中".repeat(300))).toBe(1);
    expect(estimateReadingMinutes("中".repeat(301))).toBe(2);
  });

  it("rounds English prose at 200 words per minute", () => {
    expect(estimateReadingMinutes(Array.from({ length: 200 }, () => "word").join(" "))).toBe(1);
    expect(estimateReadingMinutes(Array.from({ length: 201 }, () => "word").join(" "))).toBe(2);
  });

  it("combines Chinese and English reading time before rounding", () => {
    const content = `${"中".repeat(150)} ${Array.from({ length: 100 }, () => "word").join(" ")}`;
    expect(estimateReadingMinutes(content)).toBe(1);
  });

  it("does not count fenced code, inline code, or link URLs", () => {
    const content = [
      "Read this [short lesson](https://example.com/" + "very-long-url".repeat(50) + ").",
      "`const shouldNotCount = " + "'word '.repeat(1000)" + "`",
      "```ts",
      "const code = " + "'word '.repeat(1000)" + ";",
      "```",
    ].join("\n");
    expect(estimateReadingMinutes(content)).toBe(1);
  });

  it("keeps link and image labels as visible reader content", () => {
    const content = `[${"中".repeat(300)}](https://example.com) ![${"字".repeat(300)}](image.png)`;
    expect(estimateReadingMinutes(content)).toBe(2);
  });

  it("ignores markdown heading and list markers", () => {
    const content = Array.from({ length: 200 }, (_, i) => `- word${i}`).join("\n");
    expect(estimateReadingMinutes(content)).toBe(1);
  });

  it("< 与 > 之间的中文照算：比较句不被当成标签吞掉", () => {
    // 旧的 `/<[^>]+>/g` 会从 `<` 一路吃到最近的 `>`，把中间整句真课文抹掉。
    // 实测 118 个课文文件少算 144,762 个字符，67 篇的「预计阅读 N 分钟」被低估。
    const prose = "风险".repeat(300); // 600 字 ≈ 2 分钟
    const compared = `口径 < ${prose} 上行 > 成本`;
    const plain = `口径 ${prose} 上行 成本`;
    expect(estimateReadingMinutes(compared)).toBe(estimateReadingMinutes(plain));
    expect(estimateReadingMinutes(compared)).toBeGreaterThanOrEqual(2);
  });

  it("真正的内联标签仍然不算进阅读时间", () => {
    const tagged = `前文 <mark>${"字".repeat(600)}</mark> 后文`;
    const stripped = `前文 ${"字".repeat(600)} 后文`;
    expect(estimateReadingMinutes(tagged)).toBe(estimateReadingMinutes(stripped));
  });
});
