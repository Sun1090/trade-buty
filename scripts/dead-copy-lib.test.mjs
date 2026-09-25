import { describe, expect, it } from "vitest";
import {
  collectUsedIdentifiers,
  extractDictInterfaces,
  extractDictionaryKeys,
  findDeadDictionaryKeys,
  findUnjudgeableDictInterfaces,
  findUnreadDictFields,
  parseDeadCopyBudget,
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
      unjudgeable: [],
      scannedFiles: 2,
      generatedOn: "2026-09-23",
    });
    // 三张表各有一个「（无）」，少一张就说明台账偷偷不报了
    expect(empty.match(/（无）/g)).toHaveLength(3);
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

describe("预算与下限的读取 (R16.82)", () => {
  const GOOD = '{"budget": 0, "dictFieldBudget": 0, "minDictionaryKeys": 400, "minDictInterfaces": 18}';

  it("四项齐全才返回", () => {
    expect(parseDeadCopyBudget(GOOD)).toEqual({
      budget: 0,
      dictFieldBudget: 0,
      minDictionaryKeys: 400,
      minDictInterfaces: 18,
    });
  });

  it("少一项就抛错，并且点名是哪一项", () => {
    expect(() => parseDeadCopyBudget('{"budget": 0}')).toThrow(/dictFieldBudget/);
    expect(() => parseDeadCopyBudget('{"budget": 0}')).toThrow(/minDictInterfaces/);
  });

  it("写成字符串或负数同样抛错：`0 > undefined` 与负数下限都是永远不报的空转", () => {
    expect(() => parseDeadCopyBudget(GOOD.replace('"budget": 0', '"budget": "0"'))).toThrow(/budget/);
    expect(() => parseDeadCopyBudget(GOOD.replace('"budget": 0', '"budget": -1'))).toThrow(/不能为负/);
    expect(() => parseDeadCopyBudget("not json at all")).toThrow(/合法 JSON/);
  });
});

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

  it("接口里夹一行注释不会把整张接口判废", () => {
    // 真实代码就是这样失配的：给 AiDict 补一个字段时顺手写了一行 `/** … */`，
    // 那一路检查当场少扫一张接口，而接口总数的下限（10）根本察觉不到
    const withComments = READ_FIXTURE.replace(
      "  heading: string;",
      "  /** 标题：一行块注释也是注释，不是字段 */\n  heading: string;"
    ).replace("  tail: string;", "  tail: string; // 收尾那句");
    const dicts = extractDictInterfaces(withComments);
    expect(dicts).toHaveLength(1);
    expect(dicts[0].fields).toEqual(["heading", "hints", "tail", "neverRead"]);
    const unread = findUnreadDictFields({
      files: [{ file: "fixture.tsx", source: withComments }],
    });
    expect(unread.map((entry) => entry.field)).toEqual(["neverRead"]);
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

/**
 * R16.272：收紧后的两处口径——形状要认内联写法，读过要挂在字典那个变量上。
 *
 * 夹具照 `ai-quiz.tsx` 的真实形状来：一个 props 接口里内联 `dict: { … }`，
 * 字段一行写好几个，而 `question` 这个词在文件里到处是（`q.question` 读的是
 * AI 返回的数据对象）。旧口径两样都看不见：接口名不含 `Dict` 就整张跳过，
 * 「名字出现过就算读过」又把 `question` 判成活的。
 */
const INLINE_FIXTURE = `
interface QuizProps {
  items: string[];
  dict: {
    generate: string; question: string;
    /** 夹一行说明不算字段，不该把整张表判废 */
    done: string;
  };
}

export function Quiz({ items, dict }: QuizProps) {
  return (
    <div>
      <button>{dict.generate}</button>
      {items.map((q) => <p key={q.id}>{q.question}</p>)}
      <span>{dict.done}</span>
    </div>
  );
}
`;

const ALIAS_FIXTURE = `
interface TickerDict {
  heading: string;
  error: string;
  neverShown: string;
}

const COPY: Record<"zh" | "en", TickerDict> = {
  zh: { heading: "标题", error: "坏了", neverShown: "没人读的一句话" },
  en: { heading: "Heading", error: "Broken", neverShown: "unused line" },
};

export function Ticker({ locale }: { locale: "zh" | "en" }) {
  const dict = COPY[locale];
  return (
    <div>
      <h2>{dict.heading}</h2>
      <p>{dict.error}</p>
    </div>
  );
}
`;

describe("内联形状与「挂在字典变量上」(R16.272)", () => {
  it("认出 props 里内联的 `dict: {`，且一行好几个字段都收进来", () => {
    const dicts = extractDictInterfaces(INLINE_FIXTURE);
    expect(dicts).toHaveLength(1);
    expect(dicts[0].inline).toBe(true);
    expect(dicts[0].name).toBe("dict");
    expect(dicts[0].fields).toEqual(["generate", "question", "done"]);
  });

  it("字段名在别处出现不算读过：只认挂在字典变量上的那几种形态", () => {
    const unread = findUnreadDictFields({
      files: [{ file: "src/components/quiz.tsx", source: INLINE_FIXTURE }],
    });
    expect(unread.map((entry) => entry.field)).toEqual(["question"]);
    // 正向对照：把 `q.question` 换成 `dict.question`，这一处就该判成读过
    const fixed = INLINE_FIXTURE.replace("{q.question}", "{dict.question}");
    expect(
      findUnreadDictFields({ files: [{ file: "src/components/quiz.tsx", source: fixed }] })
    ).toEqual([]);
  });

  it("接收者从声明处推，对象字面量不当接口收；别名那一跳要跟上", () => {
    const dicts = extractDictInterfaces(ALIAS_FIXTURE);
    // 只有 `interface TickerDict`：`zh: { heading: "标题" … }` 写的是值不是类型标注
    expect(dicts).toHaveLength(1);
    expect(dicts[0].name).toBe("TickerDict");
    const unread = findUnreadDictFields({
      files: [{ file: "src/components/ticker.tsx", source: ALIAS_FIXTURE }],
    });
    // `const dict = COPY[locale]` 之后 `dict.heading` 要算读过，剩下那句是真没人读
    expect(unread.map((entry) => entry.field)).toEqual(["neverShown"]);
  });

  it("推不出字典变量的接口进「判不动」那张表，而不是静悄悄算全绿", () => {
    const foreign = `
interface FarDict {
  heading: string;
}

export function Banner({ dict }: { dict: import("./types").FarDict }) {
  return <p>{dict.heading}</p>;
}
`;
    const files = [{ file: "src/components/banner.tsx", source: foreign }];
    expect(extractDictInterfaces(foreign)).toHaveLength(1);
    expect(findUnreadDictFields({ files })).toEqual([]);
    expect(findUnjudgeableDictInterfaces({ files })).toEqual([
      { file: "src/components/banner.tsx", name: "FarDict", fieldCount: 1 },
    ]);
  });

  it("报告第三张表跟着计数走，判不动的名单非空时要看得见", () => {
    const md = renderDeadCopyMarkdown({
      dead: [],
      budget: 0,
      unread: [],
      dictFieldBudget: 0,
      unjudgeable: [{ file: "src/components/banner.tsx", name: "FarDict", fieldCount: 1 }],
      scannedFiles: 2,
      generatedOn: "2026-09-26",
    });
    expect(md).toContain("- 判不动的字典接口：1 个（须为 0）");
    expect(md).toContain("FarDict");
    expect(md).toContain("## 三、");
  });
});
