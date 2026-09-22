import { describe, expect, it } from "vitest";
import { getRandomTip, getSeedTip, TIPS_EN, TIPS_ZH } from "./tips";

describe("getRandomTip", () => {
  it("zh 返回中文池里的一条", () => {
    expect(TIPS_ZH).toContain(getRandomTip("zh"));
  });

  it("en 返回英文池里的一条", () => {
    expect(TIPS_EN).toContain(getRandomTip("en"));
  });

  it("未知 locale 回退中文池", () => {
    expect(TIPS_ZH).toContain(getRandomTip("fr"));
  });

  it("多次调用返回池中不同提示", () => {
    const tips = new Set<string>();
    for (let i = 0; i < 50; i++) tips.add(getRandomTip("zh"));
    // 池有 10 条，50 次调用应至少出现 2 条不同
    expect(tips.size).toBeGreaterThanOrEqual(2);
  });
});

describe("getSeedTip", () => {
  it("确定值：同一 locale 反复调用同一条，且不碰随机", () => {
    expect(getSeedTip("zh")).toBe(getSeedTip("zh"));
    expect(getSeedTip("en")).toBe(getSeedTip("en"));
    expect(TIPS_ZH).toContain(getSeedTip("zh"));
    expect(TIPS_EN).toContain(getSeedTip("en"));
  });
});

describe("心得池", () => {
  it("中英条数一一对应", () => {
    expect(TIPS_EN).toHaveLength(TIPS_ZH.length);
  });

  it("没有空条目或重复条目", () => {
    for (const pool of [TIPS_ZH, TIPS_EN]) {
      expect(pool.every((t) => t.trim().length > 0)).toBe(true);
      expect(new Set(pool).size).toBe(pool.length);
    }
  });
});
