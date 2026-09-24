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

  // 台账按日历只保留 90 天（study-time 的 STUDY_LEDGER_KEEP_DAYS），但裁剪锚在
  // 「最后一次学习的那天」而不是今天：三个月没打开的人，台账里就是三个月前那 90 天的账。
  // 所以标签既不能写成「总学习时长」（不存在的全历史口径），也不能写成「近 90 天」
  // （读起来是「从今天往回数 90 天」，而求和的是整本台账）。
  it("「学习时长」标签说的是台账本身，不假装是从今天算起的窗口", () => {
    const zh = getStatsDict("zh").totalStudyTime;
    const en = getStatsDict("en").totalStudyTime;
    expect(zh).toContain(`${STUDY_LEDGER_KEEP_DAYS} 天`);
    expect(en).toContain(`${STUDY_LEDGER_KEEP_DAYS} days`);
    expect(zh).toContain("台账");
    expect(en.toLowerCase()).toContain("ledger");
    expect(zh).not.toMatch(/^总/);
    expect(en).not.toMatch(/^Total/i);
    expect(zh).not.toContain("近 90 天");
    expect(en.toLowerCase()).not.toMatch(/last \d+ days/);
  });

  it("免打扰那两个读屏名字整句在字典里，中文界面不再长出裸的 start / end", () => {
    // 旧写法是 `${dict.reminderDndLabel} start`，读屏软件在中文页面上念「免打扰时段 start」。
    const zh = getStatsDict("zh");
    expect(zh.reminderDndStart).toContain("免打扰");
    expect(zh.reminderDndEnd).toContain("免打扰");
    expect(zh.reminderDndStart).not.toMatch(/[A-Za-z]{2,}/);
    expect(zh.reminderDndEnd).not.toMatch(/[A-Za-z]{2,}/);
    const en = getStatsDict("en");
    expect(en.reminderDndStart).toMatch(/start$/);
    expect(en.reminderDndEnd).toMatch(/end$/);
  });
});
