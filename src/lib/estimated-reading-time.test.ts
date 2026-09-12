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
});
