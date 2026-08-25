import { describe, it, expect } from "vitest";
import { getDailyTip } from "./tips";

describe("getDailyTip", () => {
  it("zh 返回非空字符串", () => {
    const tip = getDailyTip("zh");
    expect(typeof tip).toBe("string");
    expect(tip.length).toBeGreaterThan(0);
  });

  it("en 返回非空字符串", () => {
    const tip = getDailyTip("en");
    expect(typeof tip).toBe("string");
    expect(tip.length).toBeGreaterThan(0);
  });

  it("未知 locale 回退 zh", () => {
    const tip = getDailyTip("fr");
    expect(typeof tip).toBe("string");
    expect(tip.length).toBeGreaterThan(0);
  });

  it("多次调用返回池中不同提示", () => {
    const tips = new Set<string>();
    for (let i = 0; i < 50; i++) tips.add(getDailyTip("zh"));
    // 池有 10 条，50 次调用应至少出现 2 条不同
    expect(tips.size).toBeGreaterThanOrEqual(2);
  });
});
