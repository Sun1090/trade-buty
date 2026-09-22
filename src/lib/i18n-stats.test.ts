import { describe, expect, it } from "vitest";
import { getStatsDict, STATS_DICTS } from "./i18n-stats";
import { STUDY_LEDGER_KEEP_DAYS } from "./study-time";

function keysOf(obj: unknown, prefix = ""): string[] {
  if (typeof obj === "function") return [prefix];
  if (obj === null || typeof obj !== "object") return [prefix];
  if (Array.isArray(obj)) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keysOf(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("i18n-stats dictionary", () => {
  it("zh 和 en 深层键完全一致", () => {
    const zhKeys = keysOf(STATS_DICTS.zh).sort();
    const enKeys = keysOf(STATS_DICTS.en).sort();
    expect(zhKeys).toEqual(enKeys);
  });

  it("所有值都非空", () => {
    for (const locale of ["zh", "en"] as const) {
      for (const key of keysOf(STATS_DICTS[locale])) {
        const value = key.split(".").reduce<unknown>(
          (acc: unknown, part) => (acc as Record<string, unknown>)[part],
          STATS_DICTS[locale],
        );
        expect(typeof value === "string" ? value.trim().length : 1).toBeGreaterThan(0);
      }
    }
  });

  it("en 字典无 CJK 残留", () => {
    for (const key of keysOf(STATS_DICTS.en)) {
      const value = key.split(".").reduce<unknown>(
        (acc: unknown, part) => (acc as Record<string, unknown>)[part],
        STATS_DICTS.en,
      );
      if (typeof value === "string") {
        expect(/[\u4e00-\u9fff\u3400-\u4dbf]/.test(value)).toBe(false);
      }
    }
  });

  it("getStatsDict 按 locale 返回字典并对无效值回退 en", () => {
    expect(getStatsDict("zh").title).toBe("你的学习仪表盘");
    expect(getStatsDict("en").title).toBe("Your Learning Dashboard");
    expect(getStatsDict("ja").title).toBe(getStatsDict("en").title);
    expect(getStatsDict(undefined).title).toBe(getStatsDict("en").title);
  });

  it("R12.4/R12.5 新键在两种语言中都存在", () => {
    for (const locale of ["zh", "en"] as const) {
      const dict = getStatsDict(locale);
      expect(dict.reviewTrendTitle.length).toBeGreaterThan(0);
      expect(dict.reviewNoDates.length).toBeGreaterThan(0);
      expect(dict.replayTrendTitle.length).toBeGreaterThan(0);
      expect(dict.replayNoDurations.length).toBeGreaterThan(0);
    }
  });

  // 台账按日历只保留最近 90 天（study-time 的 STUDY_LEDGER_KEEP_DAYS），
  // 标签必须带上这个窗口：写成「总学习时长」是在承诺一个并不存在的全历史口径。
  it("「学习时长」标签写明保留窗口，不声称是全部历史", () => {
    const zh = getStatsDict("zh").totalStudyTime;
    const en = getStatsDict("en").totalStudyTime;
    expect(zh).toContain(`${STUDY_LEDGER_KEEP_DAYS} 天`);
    expect(en).toContain(`${STUDY_LEDGER_KEEP_DAYS} days`);
    expect(zh).not.toMatch(/^总/);
    expect(en).not.toMatch(/^Total/i);
  });
});
