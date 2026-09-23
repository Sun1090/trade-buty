import { describe, expect, it } from "vitest";
import {
  collectUsedIdentifiers,
  extractDictionaryKeys,
  findDeadDictionaryKeys,
  renderDeadCopyMarkdown,
  shouldFailDeadCopy,
} from "./dead-copy-lib.mjs";

/**
 * 巡检器自己的用例。这里出现的键名**故意**与真实代码无关：如果按「标识符出现过就算活」
 * 的口径直接扫全仓，这些字符串会互相把对方判成「活着」，所以判定一律只在下面的夹具字符串
 * 之间做，不碰真实仓库。
 */
const DICT_FIXTURE = `
const zh = {
  liveGreeting: "你好",
  deadOrphan: "没人读的一句话",
  group: {
    nestedLive: "a",
    nestedDead: "b",
  },
};

type Dict = typeof zh;

const en: Dict = {
  liveGreeting: "hello",
  deadOrphan: "a sentence nobody reads",
  group: {
    nestedLive: "a",
    nestedDead: "b",
  },
};
`;

describe("dead-copy lib (R16.21)", () => {
  it("字典块里中英文两侧的键都被提取（含嵌套组）", () => {
    const keys = extractDictionaryKeys(DICT_FIXTURE);
    expect(keys).toEqual(
      ["deadOrphan", "group", "liveGreeting", "nestedDead", "nestedLive"].sort()
    );
  });

  it("非字典语料里出现过的键不算死，没出现的算死", () => {
    const used = collectUsedIdentifiers([
      `const g = dict.liveGreeting; const n = dict.group.nestedLive;`,
    ]);
    const dead = findDeadDictionaryKeys({
      dicts: [{ file: "fixture.ts", keys: extractDictionaryKeys(DICT_FIXTURE) }],
      used,
    });
    expect(dead.map((d) => d.key)).toEqual(["deadOrphan", "nestedDead"]);
  });

  it("正向对照：巡检器必须真的能报出一个已知死键", () => {
    // 若这一条永远通过，说明提取或比对已经失效——整张台账会变成空转
    const keys = extractDictionaryKeys(DICT_FIXTURE);
    expect(keys).toContain("deadOrphan");
    const dead = findDeadDictionaryKeys({
      dicts: [{ file: "fixture.ts", keys }],
      used: collectUsedIdentifiers([]),
    });
    expect(dead.length).toBe(keys.length);
  });

  it("预算：死键数超过 budget 才失败", () => {
    expect(shouldFailDeadCopy({ dead: [{ key: "a" }, { key: "b" }], budget: 2 })).toBe(
      false
    );
    expect(shouldFailDeadCopy({ dead: [{ key: "a" }, { key: "b" }], budget: 1 })).toBe(
      true
    );
  });

  it("报告里逐条点名，且空表也写清楚", () => {
    const md = renderDeadCopyMarkdown({
      dead: [{ file: "src/lib/i18n.ts", key: "deadOrphan" }],
      budget: 0,
      scannedFiles: 2,
      generatedOn: "2026-09-23",
    });
    expect(md).toContain("src/lib/i18n.ts");
    expect(md).toContain("deadOrphan");
    const empty = renderDeadCopyMarkdown({
      dead: [],
      budget: 0,
      scannedFiles: 2,
      generatedOn: "2026-09-23",
    });
    expect(empty).toContain("（无）");
  });
});
