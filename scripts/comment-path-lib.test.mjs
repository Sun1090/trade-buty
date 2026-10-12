/**
 * R16.317：注释路径判据自己的用例。
 *
 * 这道门禁的价值全在「抓得住从未存在过的路径」上，所以每条正则都先证明它抓得住
 * 本轮实测到的那四种真实写法，再证明它不抓三种真实假阳性。
 */
import { describe, expect, it } from "vitest";
import {
  COMMENT_PATH_EXCUSED,
  MIN_REFS_FLOOR,
  auditCommentPathClaims,
  extractCommentPathRefs,
  resolveRef,
} from "./comment-path-lib.mjs";

const trackedFiles = new Set([
  "src/lib/content.ts",
  "scripts/manifest-artifact.mjs",
  "src/components/ai-error-cause-claims.test.ts",
  "content/kline-buty/scripts/kb-anchor-check.mjs",
  "docs/plan.md",
]);
const existsSync = (rel) => rel === "node_modules/@supabase/ssr/dist/main/createBrowserClient.js";
const isIgnored = (rel) => rel === "src/lib/kb-titles.json";

/**
 * 夹具底座：按豁免表逐条造一行「那句话还在」的合成源码。
 *
 * 「豁免不再被用到就转红」是判据之一，所以任何只喂局部文件的用例都会先撞它。
 * 底座由表推导而不是手抄：表里加一条豁免，这里不用跟着改；表里留着一条却没人引用它，
 * 判据照样红——双向核对一点没松。
 */
const EXCUSED_SOURCES = Object.fromEntries(
  COMMENT_PATH_EXCUSED.map((entry) => [
    entry.file,
    " * 反例引用：`" + entry.ref + "`\n",
  ]),
);

/** 底座自己认出的引用数：各条用例核的是增量而不是绝对值。 */
const BASE_REFS = auditCommentPathClaims({
  sources: EXCUSED_SOURCES,
  trackedFiles,
  existsSync,
  isIgnored,
}).refs;

const audit = (sources) =>
  auditCommentPathClaims({
    sources: { ...EXCUSED_SOURCES, ...sources },
    trackedFiles,
    existsSync,
    isIgnored,
  });

describe("extractCommentPathRefs：只认注释行里的仓库路径", () => {
  it("行注释、块注释头、逐行 * 三种写法都认", () => {
    for (const line of [
      "// 见 `src/lib/kb-links.ts`",
      "/* 见 src/lib/kb-links.ts */",
      " * 见 src/lib/kb-links.ts",
    ]) {
      expect(extractCommentPathRefs(line), line).toEqual(["src/lib/kb-links.ts"]);
    }
  });

  it("代码里的字符串字面量不算引用", () => {
    expect(extractCommentPathRefs('const p = "src/lib/kb-links.ts";')).toEqual([]);
    // 反引号模板里的路径**不**被引号规则剥掉（反引号是本仓注释点名文件的主流写法），
    // 所以这一半必须由「不是注释行」这条判据挡住，而不是靠引号。
    expect(extractCommentPathRefs("const p = `src/lib/kb-links.ts`;")).toEqual([]);
  });

  it("引号包裹的示例路径不算引用（`path.join(root, \"docs/x.md\")` 那一族）", () => {
    expect(
      extractCommentPathRefs('// 落盘路径写成 path.join(root, "docs/x.md") 的字面形状'),
    ).toEqual([]);
  });

  it("反引号包裹的**是**引用：那是本仓注释点名文件的主流写法", () => {
    expect(extractCommentPathRefs("// 判据本身在 `src/lib/x.ts`")).toEqual(["src/lib/x.ts"]);
  });

  it("扩展名不被截断：.json 不会读成 .js", () => {
    expect(extractCommentPathRefs("// 输出 src/lib/kb-titles.json 供门禁读")).toEqual([
      "src/lib/kb-titles.json",
    ]);
    expect(extractCommentPathRefs("// 组件在 src/components/markdown.tsx 里")).toEqual([
      "src/components/markdown.tsx",
    ]);
  });

  it("行尾的中文句号与逗号不吃进路径", () => {
    expect(extractCommentPathRefs("// 见 src/lib/content.ts。")).toEqual(["src/lib/content.ts"]);
  });

  it("日期模板与通配写法在抽取阶段就滤掉：它们不该进引用数的分母", () => {
    expect(extractCommentPathRefs("// 生成 docs/kb-changelog-YYYY-MM-DD.md")).toEqual([]);
    expect(extractCommentPathRefs("// 匹配 src/**\/*.ts 这一族")).toEqual([]);
  });

  it("非注释行一律跳过", () => {
    expect(extractCommentPathRefs('writeFileSync("src/lib/nope.ts", "")')).toEqual([]);
  });
});

describe("resolveRef：一条引用可以在哪些根下核对", () => {
  it("本站路径同时给出 kline-buty 候选，整行改根不再误判", () => {
    expect(resolveRef("scripts/kb-anchor-check.mjs").candidates).toEqual([
      "scripts/kb-anchor-check.mjs",
      "content/kline-buty/scripts/kb-anchor-check.mjs",
    ]);
  });

  it("node_modules 前缀只按依赖根核对，不再拼本站/子模块候选", () => {
    expect(resolveRef("node_modules/@supabase/ssr/dist/main/createBrowserClient.js").candidates).toEqual([
      "node_modules/@supabase/ssr/dist/main/createBrowserClient.js",
    ]);
  });

  it("依赖路径里的单字母文件名不被当成占位符（`dist/main/x.js` 是真文件）", () => {
    expect(extractCommentPathRefs("// 见 node_modules/@supabase/ssr/dist/main/x.js")).toEqual([
      "node_modules/@supabase/ssr/dist/main/x.js",
    ]);
  });
});

describe("auditCommentPathClaims", () => {
  it("抓得住本轮实测的四种真实失效写法", () => {
    const { issues, refs } = audit({
      "src/components/markdown.tsx": "// 这条正则是 `rewriteLinks`（src/lib/kb-links.ts）的契约\n",
      "scripts/check-bundle.mjs": "// 判据本身在 `src/lib/manifest-artifact.mjs`\n",
      "src/components/ai-chat.tsx": " * 见 `src/lib/ai-error-cause-claims-wrong.test.ts`。\n",
      "src/components/review-client.tsx": "// scripts/ai-quiz-copy-single-source.test.mjs 守住\n",
    });
    expect(refs - BASE_REFS, "四条失效引用应各计一次").toBe(4);
    expect(issues).toHaveLength(4);
    expect(issues[0]).toContain("src/components/markdown.tsx:1");
  });

  it("改到真实主人后判绿：同一份文件换个路径名不再响", () => {
    expect(
      audit({
        "src/components/markdown.tsx": "// 这条正则是 `rewriteLinks`（src/lib/content.ts）的契约\n",
      }).issues,
    ).toEqual([]);
  });

  it("kline-buty 与 node_modules 两个根下的文件算存在", () => {
    const { issues } = audit({
      "src/lib/heading-id.ts": " * | 知识库 `slugify()` | kline-buty `scripts/kb-anchor-check.mjs` | 剥掉 |\n",
      "src/lib/privacy-export.ts": " * 见 `node_modules/@supabase/ssr/dist/main/createBrowserClient.js`）。\n",
    });
    expect(issues).toEqual([]);
  });

  it("构建产物（.gitignore 掉的路径）算合法引用：干净检出上它本来就不存在", () => {
    const { issues } = audit({
      "scripts/generate-kb-titles.mjs": " * 输出: src/lib/kb-titles.json 供门禁读取\n",
    });
    expect(issues).toEqual([]);
  });

  it("同一行既有本站路径又有子模块路径时，各按各的根核对", () => {
    const { issues } = audit({
      "scripts/risk-warning-lib.mjs":
        " * 产品红线（docs/plan.md）：每篇内容必须带风险提示块（继承 kline-buty 规范）。\n",
    });
    expect(issues).toEqual([]);
  });

  it("豁免条目必须双向核对：路径真的存在时豁免自己转红", () => {
    expect(audit({}).issues).toEqual([]);
    const inverted = auditCommentPathClaims({
      sources: EXCUSED_SOURCES,
      trackedFiles: new Set([...trackedFiles, "docs/whatever.md", "src/lib/kb-links.ts"]),
      existsSync,
      isIgnored,
    });
    expect(inverted.issues.join("\n")).toContain("豁免已失效");
  });

  it("豁免不再被用到就转红：那句话改掉后不能让豁免留着", () => {
    const { issues } = auditCommentPathClaims({
      sources: { "src/lib/content.ts": "// 正常引用 src/lib/content.ts\n" },
      trackedFiles,
      existsSync,
      isIgnored,
    });
    expect(issues.join("\n")).toContain("没有被用到");
  });

  it("扫描数量地板是正整数：写成 0 会让这道门禁永远不会响", () => {
    expect(Number.isInteger(MIN_REFS_FLOOR)).toBe(true);
    expect(MIN_REFS_FLOOR).toBeGreaterThan(0);
  });

  it("豁免表本身不为空，也不含重复条目", () => {
    expect(COMMENT_PATH_EXCUSED.length).toBeGreaterThan(0);
    const keys = COMMENT_PATH_EXCUSED.map((e) => `${e.file}|${e.ref}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of COMMENT_PATH_EXCUSED) {
      expect(entry.reason.length, `${entry.ref} 的豁免没写理由`).toBeGreaterThan(10);
    }
  });
});
