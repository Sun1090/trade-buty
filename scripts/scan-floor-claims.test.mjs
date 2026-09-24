import fs from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * R16.83：`docs/ops.md` 里那五句「低于下限 N 就失败」是转述，数字的主人在脚本里。
 * 与 R16.34 同一类毛病：代码改了数，文档不会变红，读者却照那段判断「这道门禁到底看了
 * 多少东西」。所以这里把每一处转述钉回常量，并要求句式还在——改成「低于某个下限」就
 * 等于绕过核对。
 *
 * 下限一律从**源码文本**里取，不 import 那些脚本：它们是 CLI，模块顶层就跑完整轮扫描。
 */

const opsPath = "docs/ops.md";

function exportedNumber(file, name) {
  const m = new RegExp(`export const ${name} = (\\d+);`).exec(fs.readFileSync(file, "utf8"));
  if (!m) throw new Error(`${file} 里找不到 \`export const ${name} = <整数>;\`——下限换了写法，文档转述就没人核对了`);
  return Number(m[1]);
}

/** 参与对账的文档篇数：脚本里那行 `export const AUDITED_DOCS = [...]` 列了几篇就是几篇。 */
function auditedDocCount() {
  const m = /export const AUDITED_DOCS = \[([^\]]*)\]/.exec(
    fs.readFileSync("scripts/db-assertion-counts.mjs", "utf8"),
  );
  if (!m) throw new Error("scripts/db-assertion-counts.mjs 里找不到 AUDITED_DOCS 数组");
  return [...m[1].matchAll(/"docs\/[^"]+"/g)].length;
}

/** 找到门禁表里某一行的正文（首列命令精确匹配）。 */
function rowOf(ops, command) {
  const line = ops.split("\n").find((l) => l.startsWith(`| \`npm run ${command}\` |`));
  if (!line) throw new Error(`docs/ops.md 门禁表里没有 \`npm run ${command}\` 这一行`);
  return line;
}

const FLOORS = [
  {
    label: "知识库 md 文件数下限",
    command: "check:frontmatter",
    doc: (row) => Number(/低于下限 (\d+)/.exec(row)?.[1] ?? NaN),
    actual: () => exportedNumber("scripts/check-frontmatter.mjs", "MIN_KB_FILES"),
  },
  {
    label: "en / zh 语言树文件数下限",
    command: "check:kb-en-content",
    doc: (row) => Number(/低于下限 (\d+)/.exec(row)?.[1] ?? NaN),
    actual: () => exportedNumber("scripts/check-kb-en-content.mjs", "MIN_LOCALE_FILES"),
  },
  {
    label: "待扫文件清单下限",
    command: "check:secrets",
    doc: (row) => Number(/低于下限 (\d+)/.exec(row)?.[1] ?? NaN),
    actual: () => exportedNumber("scripts/check-secrets.mjs", "MIN_LISTED_FILES"),
  },
  {
    label: "route.ts 数量下限",
    command: "check:request-body-bounds",
    doc: (row) => Number(/少于下限 (\d+)/.exec(row)?.[1] ?? NaN),
    actual: () => exportedNumber("scripts/request-body-bounds.mjs", "MIN_ROUTE_FILES"),
  },
  {
    label: "参与对账的现行文档篇数",
    command: "check:db-assertion-counts",
    doc: (row) => Number(/声明的 (\d+) 篇/.exec(row)?.[1] ?? NaN),
    actual: () => auditedDocCount(),
  },
];

const ops = fs.readFileSync(opsPath, "utf8");

describe("docs/ops.md 的扫描下限转述（R16.83）", () => {
  it("每处数字都等于脚本里的那个下限常量", () => {
    const mismatched = [];
    for (const floor of FLOORS) {
      const row = rowOf(ops, floor.command);
      const cited = floor.doc(row);
      if (!Number.isFinite(cited)) {
        mismatched.push(`${floor.label}：这一行没读到数字（把「下限 N」改成措辞会绕过核对，请同步本门禁）`);
        continue;
      }
      if (cited !== floor.actual()) {
        mismatched.push(`${floor.label}：文档写 ${cited}，脚本是 ${floor.actual()}`);
      }
    }
    expect(mismatched, `docs/ops.md 与脚本下限不一致：\n${mismatched.join("\n")}`).toEqual([]);
  });

  it("核对确实取到数字，不是在跟空集合说话", () => {
    // 五处转述各自还在；全表为空时上一例会退化成「零条待核对」的假绿。
    expect(FLOORS.length).toBe(5);
    for (const floor of FLOORS) {
      expect(floor.actual(), `${floor.command} 的下限应当是个正数`).toBeGreaterThan(0);
    }
  });

  it("数字被抹成措辞时当场判失败，而不是静默跳过", () => {
    const cited = FLOORS[0].doc(rowOf(ops, FLOORS[0].command)); // 文档此刻转述的那个数，不在这里再抄一份
    const rewritten = ops.replace(`低于下限 ${cited}`, "低于某个下限");
    expect(rewritten).not.toBe(ops); // 前提：那句转述还在这里
    expect(FLOORS[0].doc(rowOf(rewritten, FLOORS[0].command))).toBeNaN();
  });
});
