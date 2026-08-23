import { describe, expect, it } from "vitest";
import { chapterRank, CHAPTER_ORDER } from "./kb-order";

describe("chapterRank", () => {
  it("已知篇章按规范顺序排", () => {
    expect(chapterRank("getting-started")).toBe(0);
    expect(chapterRank("spot")).toBe(1);
    expect(chapterRank("options-strategies")).toBe(CHAPTER_ORDER.length - 1);
  });

  it("未知篇章排到末尾", () => {
    const unknown = chapterRank("unknown-chapter");
    expect(unknown).toBeGreaterThanOrEqual(1000);
  });

  it("未知篇章之间按字母序区分", () => {
    const a = chapterRank("aaa-unknown");
    const b = chapterRank("zzz-unknown");
    expect(a).toBeLessThan(b);
  });

  it("所有 CHAPTER_ORDER 项 rank 小于 1000", () => {
    for (let i = 0; i < CHAPTER_ORDER.length; i++) {
      expect(chapterRank(CHAPTER_ORDER[i])).toBe(i);
    }
  });
});
