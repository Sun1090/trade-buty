import { describe, expect, it } from "vitest";
import {
  computeTranslationStats,
  snapshotOf,
  mergeSnapshot,
  diffWithLatest,
} from "../../scripts/translation-status-lib.mjs";

const zh = new Map([
  ["spot", ["a.md", "b.md", "c.md"]],
  ["futures", ["x.md", "y.md"]],
  ["stocks", ["p.md"]],
]);
const en = new Map([
  ["spot", ["a.md", "c.md"]],
  ["futures", ["x.md", "y.md"]],
]);

describe("translation-status lib (R10.19)", () => {
  it("computeTranslationStats 汇总 zh/en 计数与逐章覆盖", () => {
    const s = computeTranslationStats({ zh, en });
    expect(s.zhChapters).toBe(3);
    expect(s.zhDocs).toBe(6);
    expect(s.enDirs).toBe(2);
    expect(s.enDocs).toBe(4); // spot 2 + futures 2
    expect(s.overlapChapters).toBe(2); // stocks 无 en
    expect(s.overlapDocs).toBe(4); // a,c,x,y
    expect(s.perChapter).toContainEqual({ chapter: "spot", zh: 3, en: 2, overlap: 2 });
    expect(s.perChapter).toContainEqual({ chapter: "stocks", zh: 1, en: 0, overlap: 0 });
  });

  it("snapshotOf 附带日期", () => {
    const s = computeTranslationStats({ zh, en });
    expect(snapshotOf(s, "2026-09-06").date).toBe("2026-09-06");
  });

  it("mergeSnapshot 同日幂等覆盖", () => {
    const a = snapshotOf(computeTranslationStats({ zh, en }), "2026-09-06");
    const b = snapshotOf(computeTranslationStats({ zh, en }), "2026-09-06");
    const out = mergeSnapshot([a], b);
    expect(out).toHaveLength(1);
  });

  it("mergeSnapshot 按日期升序并保留最近 N 条", () => {
    const mk = (date: string) => ({ date, n: 1 });
    const out = mergeSnapshot([mk("2026-09-05")], mk("2026-09-06"), 2);
    expect(out.map((x) => x.date)).toEqual(["2026-09-05", "2026-09-06"]);
    const trimmed = mergeSnapshot([mk("2026-09-01"), mk("2026-09-02")], mk("2026-09-03"), 2);
    expect(trimmed.map((x) => x.date)).toEqual(["2026-09-02", "2026-09-03"]);
  });

  it("diffWithLatest：一致 → ok，且最近快照缺省也识别", () => {
    const s = computeTranslationStats({ zh, en });
    const latest = snapshotOf(s, "2026-09-06");
    expect(diffWithLatest(s, latest).ok).toBe(true);
    expect(diffWithLatest(s, undefined).ok).toBe(false);
  });

  it("diffWithLatest：计数变化判过期", () => {
    const s = computeTranslationStats({ zh, en });
    const changed = computeTranslationStats({
      zh: new Map([...zh, ["career", ["q.md"]]]),
      en,
    });
    const r = diffWithLatest(changed, snapshotOf(s, "2026-09-06"));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("zh 章节数");
  });

  it("diffWithLatest：逐章覆盖明细变化（顶层计数不变）也判过期", () => {
    const s = computeTranslationStats({ zh, en });
    const latest = snapshotOf(s, "2026-09-06");
    // 顶层计数原样、仅逐章明细被篡改 → 走 perChapter 深比较分支
    const tampered = {
      ...latest,
      perChapter: latest.perChapter.map((r: { chapter: string; overlap: number; zh: number; en: number }) =>
        r.chapter === "futures" ? { ...r, overlap: r.overlap - 1 } : r,
      ),
    };
    const r = diffWithLatest(s, tampered);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("逐章覆盖明细");
  });
});
