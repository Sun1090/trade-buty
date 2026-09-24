import { describe, expect, it } from "vitest";
import {
  collectUsedIdentifiers,
  extractDictInterfaces,
  extractDictionaryKeys,
  findDeadDictionaryKeys,
  findUnreadDictFields,
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
      unread: [{ file: "src/components/banner.tsx", name: "BannerDict", field: "neverRead" }],
      dictFieldBudget: 0,
      scannedFiles: 2,
      generatedOn: "2026-09-23",
    });
    expect(md).toContain("src/lib/i18n.ts");
    expect(md).toContain("deadOrphan");
    expect(md).toContain("BannerDict");
    expect(md).toContain("neverRead");
    const empty = renderDeadCopyMarkdown({
      dead: [],
      budget: 0,
      unread: [],
      dictFieldBudget: 0,
      scannedFiles: 2,
      generatedOn: "2026-09-23",
    });
    // 两张表各有一个「（无）」，少一张就说明台账偷偷不报了
    expect(empty.match(/（无）/g)).toHaveLength(2);
  });
});

/**
 * R16.78：组件自己声明的字典接口。夹具里的字段名与真实代码无关，理由同上。
 */
const READ_FIXTURE = `
export interface BannerDict {
  heading: string;
  hints: string[];
  tail: string;
  neverRead: string;
}

const SLOTS = [{ key: "hints" }];

export function Banner({ dict }: { dict: BannerDict }) {
  const { tail } = dict;
  return (
    <div>
      <p>{dict.heading}</p>
      {SLOTS.map((slot) => <li key={slot.key}>{dict[slot.key]}</li>)}
      <span>{tail}</span>
    </div>
  );
}
`;

const MIXED_FIXTURE = `
interface ControlDict {
  title: string;
  onPick: (id: string) => void;
  nested: { deep: string };
}
`;

describe("组件字典接口的未读字段 (R16.78)", () => {
  it("认出接口名与全部文案字段（含 string[]）", () => {
    const dicts = extractDictInterfaces(READ_FIXTURE);
    expect(dicts).toHaveLength(1);
    expect(dicts[0].name).toBe("BannerDict");
    expect(dicts[0].fields).toEqual(["heading", "hints", "tail", "neverRead"]);
  });

  it("混了回调或嵌套对象的接口整个跳过", () => {
    expect(extractDictInterfaces(MIXED_FIXTURE)).toEqual([]);
  });

  it("成员访问、解构、字符串常量当动态键都算读过；只在声明里出现的算未读", () => {
    const unread = findUnreadDictFields({ files: [{ file: "fixture.tsx", source: READ_FIXTURE }] });
    expect(unread.map((entry) => entry.field)).toEqual(["neverRead"]);
  });

  it("正向对照：把读掉的那几处摘干净，未读就该是全部字段", () => {
    // 若这一条恒为 1 个，说明判定其实只在数声明块之外的 token，夹具改坏也测不出来
    const stripped = READ_FIXTURE.replace("dict.heading", "x")
      .replace("tail } = dict", "} = dict")
      .replace('key: "hints"', 'key: "other"')
      .replace("<span>{tail}</span>", "<span>{\"x\"}</span>");
    const unread = findUnreadDictFields({ files: [{ file: "fixture.tsx", source: stripped }] });
    expect(unread.map((entry) => entry.field).sort()).toEqual(
      ["heading", "hints", "neverRead", "tail"].sort()
    );
  });

  it("判定是逐文件的：别的文件读过同一个字段名不算数", () => {
    // 这正是整键口径看不见这一类的原因——页面装配点就是「别的文件」
    const unread = findUnreadDictFields({
      files: [
        { file: "src/components/banner.tsx", source: READ_FIXTURE },
        { file: "src/app/page.tsx", source: `const d = { neverRead: t.banner.neverRead }; void d;` },
      ],
    });
    expect(unread).toEqual([
      { file: "src/components/banner.tsx", name: "BannerDict", field: "neverRead" },
    ]);
  });
});
