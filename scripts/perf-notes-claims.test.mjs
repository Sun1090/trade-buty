/**
 * R16.236：`docs/perf-notes.md` 里那些描述预算清单自己的句子，必须由清单自己签字。
 *
 * 这一节是全仓库唯一一处用自然语言转述 `scripts/bundle-budgets.json` 的地方，而它此前
 * 有三句话没有任何东西对着：
 * - 「分组：home、path、…、auth」——加一个分组、删一个分组、改一个 `id`，文档都不会红，
 *   读者据此以为清单里就这几种表面；
 * - 「`bundle-budget.mjs` 提供校验、匹配、资产提取和测量纯函数，并纳入 Vitest」——
 *   四个抽象名词没有指名道姓，函数改名或那条 Vitest 用例不再导入它们，这句话照样读得通；
 * - 「整体 JS 预算仍按分组**收紧**（例如 lessons 310KB、AI 315KB…）」——这一句两头都不实：
 *   一是名字对不上清单（`lessons` / `AI` 不是任何条目的 `id`，抄的人只能靠猜），二是从
 *   建表那天起 `js` 那一列一个数都没动过，而 `knowledge-lesson` 的 `total` 恰恰在
 *   2026-09-25 被**放宽**（400 → 404，见 R16.234），写着「收紧」的叙述把这笔正在还的债
 *   说反了。现在这句话只陈述「按分组各设四条上限」，并逐个点名 `id` + 指标 + 数值。
 *
 * 三处都是**从权威推导**：分组名与数值来自 `bundle-budgets.json`，函数名来自
 * `bundle-budget.mjs` 的真实导出、以及那份用例的导入清单，没有一个数字是从文档里抄回来的。
 * 下面那些 `≥` 地板按 R16.113 的教训配齐：扫不到东西的门禁等于没有门禁。
 *
 * 运行：`npx vitest run scripts/perf-notes-claims.test.mjs`（跟随 `npm test`）
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as budgetLib from "./bundle-budget.mjs";

const root = process.cwd();
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const doc = read("docs/perf-notes.md");
// 与 `bundle-budget.test.mjs` 同一份读法：这个仓库没有开 import attributes。
const manifest = JSON.parse(read("scripts/bundle-budgets.json"));

/** 取以某个前缀开头的那一行正文（找不到就当场红，别让扫描空转） */
function docLine(prefix, why) {
  const line = doc.split("\n").find((l) => l.startsWith(prefix));
  expect(line, `docs/perf-notes.md 里找不到以「${prefix}」开头的那一行——${why}`).toBeTruthy();
  return line;
}

const budgets = manifest.budgets;

describe("perf-notes 转述的预算清单就是清单本身", () => {
  it("清单当前是有效的（下面几条都以它为准）", () => {
    expect(budgets.length).toBeGreaterThanOrEqual(10);
    expect(budgetLib.validateBudgetManifest(manifest)).toEqual([]);
  });

  it("「分组：…」那一串 id 与清单同名、同序", () => {
    const listed = docLine("- 分组：", "读者就没有任何地方能查出这一层到底分了几组").slice(
      "- 分组：".length,
    );
    const names = listed.split("（")[0].split("、").map((s) => s.trim()).filter(Boolean);
    expect(names.length, "分组那一行没解析出任何名字").toBeGreaterThanOrEqual(budgets.length);
    expect(names, `文档列的分组与清单不一致（清单是 ${budgets.map((b) => b.id).join("、")}）`).toEqual(
      budgets.map((b) => b.id),
    );
  });

  it("点名到函数的四个能力确实导出，也确实进了 Vitest", () => {
    // 「提供校验、匹配、资产提取和测量纯函数」这类抽象说法无法核对，写成 `函数名` 之后
    // 才有权威：导出表 + 那份用例的具名导入清单。第二样必须是**导入清单**而不是「文件里
    // 提过这个名字」——探针 P8 证明差别：只查文本出现时，从 import 里删掉 `measureRoute,`
    // 而函数体里照旧用着它，门禁绿灯，而文档那句「逐个导入」已经不实。
    const line = docLine("- 预算与实现规则分离：", "这句话是「预算与实现分离」这条规矩的唯一落点");
    const named = [...line.matchAll(/`([a-z][A-Za-z]{3,})`/g)].map((m) => m[1]);
    expect(named.length, "那一行没点到任何函数名——又退回抽象说法了？").toBeGreaterThanOrEqual(6);
    const imported = (() => {
      // `[^}]*` 而不是 `[\s\S]*?`：后者会从上面那条 `import { describe, expect, it } from "vitest"`
      // 一路吃到这里，把 vitest 的三个名字也算成「导入过」。BASE 不绿时才暴露出来。
      const block =
        /import\s*\{([^}]*)\}\s*from\s*"\.\/bundle-budget\.mjs"/.exec(read("scripts/bundle-budget.test.mjs"));
      expect(
        block,
        "bundle-budget.test.mjs 不再从 bundle-budget.mjs 具名导入——文档那句「纳入 Vitest」没有落点了",
      ).toBeTruthy();
      return new Set(block[1].split(",").map((s) => s.trim()).filter(Boolean));
    })();
    for (const name of named) {
      expect(budgetLib[name], `文档点名的 ${name}() 并不是 bundle-budget.mjs 的导出`).toBeTypeOf("function");
      expect(imported.has(name), `文档说「纳入 Vitest」，可 bundle-budget.test.mjs 没有导入 ${name}`).toBe(true);
    }
  });
});

describe("perf-notes 引用的预算数值等于清单里的数值", () => {
  /** `<id> <指标> <数字>KB` —— 点名到 id 和指标，抄错哪一个都会红 */
  const citations = (line) =>
    [...line.matchAll(/\b([a-z][a-z0-9-]*) (js|css|html|total) (\d+(?:\.\d+)?)KB\b/g)].map((m) => ({
      id: m[1],
      metric: m[2],
      kb: Number(m[3]),
    }));

  it("正文里那几处 KB 引用逐条对得上清单", () => {
    const line = docLine(
      "`npm run check:bundle`",
      "转述预算形状（按分组、四列）的那一句是读者理解门禁尺子的唯一入口",
    );
    const found = citations(line);
    expect(found.length, "这一句里没有 `<id> <指标> <数字>KB` 形状的引用了——数字不许再靠手抄").toBeGreaterThanOrEqual(4);
    for (const { id, metric, kb } of found) {
      const budget = budgets.find((b) => b.id === id);
      expect(budget, `文档引用的分组 ${id} 在清单里不存在`).toBeTruthy();
      expect(
        budget.maxGzipKB[metric],
        `文档写 ${id} 的 ${metric} 是 ${kb}KB，清单里是 ${budget.maxGzipKB[metric]}KB`,
      ).toBe(kb);
    }
  });

  it("放宽了 total 的那一组，文档不许说「收紧」", () => {
    // R16.234 把 knowledge-lesson.total 从 400 让到 404。这一条不是防别人，是防下一轮的
    // 我自己顺手把那句叙述写回「预算按分组收紧」——那正是本轮要改掉的那句话。
    expect(docLine("`npm run check:bundle`", "同上")).not.toMatch(/预算[^。]*收紧/);
  });
});
