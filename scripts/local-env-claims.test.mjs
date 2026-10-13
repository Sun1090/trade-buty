/**
 * R16.335：「脚本自己解析 .env.local 塞进 process.env」这条实现点必须只有一条路。
 *
 * 病灶形状与 R16.322 / R16.329 / R16.330 同族（清单没有主人、约定按全仓实现点量）：
 * 两处同形的手搓解析器（`faq-candidates.mjs`、`generate-embeddings.mjs`）用
 * `^([A-Z_]+)=(.*)$` 且不剥引号，`npx vercel deploy` 改写 `.env.local` 后两个脚本当场崩
 * （2026-10-13 实测撞过）。修掉这两处之后，如果没有人钉住「别再长第三处」，
 * 下一次有人写 `for (const line of readFileSync(".env.local"))` 时不会有任何东西提醒他。
 *
 * 判据用**可推导的关系**而不是手抄名单：任何非测试脚本，只要它同时
 * ① 提到 `.env.local` 且 ② 往 `process.env[...]` 里写值，就必须走 `loadLocalEnv`。
 * 这条谓词放过 `env-docs.mjs`——它读 `.env.example` 是为了跟文档对账，
 * 一次都不写 `process.env`，所以是另一件事（同值不是同一事，R16.319/R16.320 那条规矩）。
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// 复用同一份「涂白注释」的尺子，不在这里再抄一遍正则（R16.333 抽共享尺子的同一条理由）
import { blankComments } from "./page-template-coverage-lib.mjs";

const root = process.cwd();

const scripts = execFileSync("git", ["ls-files", "-z", "scripts/*.mjs"], { cwd: root, encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((f) => !f.includes(".test."));

/**
 * 谓词：往 `process.env[...]` 里写值，却没走 `loadLocalEnv` —— 就是手搓解析器。
 *
 * 两处形状细节都是被变异实验教出来的：
 * ① 内层下标必须允许再套一层方括号。真实病灶是 `process.env[m[1]] = m[2]`，
 *   而 `\[[^\]]+\]` 在 `m[1]` 那个 `]` 处就停了——**第一版因此完全抓不到病灶**，
 *   变异实验红是红了，却红在「正向认领」那条上，主判据静默通过。
 *   所以这里用 `[^\n]*?\]`（不跨行 + 非贪婪，取最后一个 `]`）。
 * ② 必须先涂白注释：`// process.env[KEY] = x` 这种说明文字会被同一条正则命中，
 *   不涂白就是把「解释这个病怎么写」判成有病。
 */
function isHandRolledParser(source) {
  const code = blankComments(source);
  // 「真的调用」而不是「文件里出现过这个词」：只 import 不调用、或者注释里提一句，
  // 都不该让它逃过判据（变异实验教的第二课）。
  return /process\.env\[[^\n]*?\]\s*=/.test(code) && !/loadLocalEnv\s*\(/.test(code);
}

/** 提到 .env.local 的脚本，按「是否自己写 process.env」分类 */
const mentions = scripts.filter((f) => readFileSync(path.join(root, f), "utf8").includes(".env.local"));
const handRolled = mentions.filter((f) => isHandRolledParser(readFileSync(path.join(root, f), "utf8")));

describe("脚本读 .env.local 只有一条路", () => {
  it("扫描面不是空转：确实有脚本提到 .env.local，且 env-docs 被正确排除", () => {
    expect(mentions.length, "没有一份脚本提到 .env.local，扫描本身坏了").toBeGreaterThanOrEqual(2);
    // env-docs.mjs 读 .env.example 做文档对账，不写 process.env，属于另一件事
    expect(mentions).toContain("scripts/env-docs.mjs");
    expect(handRolled, "env-docs 不该被算成手搓解析器").not.toContain("scripts/env-docs.mjs");
  });

  it("全仓没有第三处手搓的 .env.local 解析器", () => {
    expect(
      handRolled,
      `这些脚本自己解析 .env.local 并写进 process.env：${handRolled.join(", ")}——改用 loadLocalEnv（见 local-env-lib.mjs）。` +
        "手搓正则不剥引号，而 vercel CLI 会把值写成带引号的形状",
    ).toEqual([]);
  });

  it("两个既有调用点确实走这条路（正向认领，防止谓词永远不匹配而空转）", () => {
    for (const f of ["scripts/faq-candidates.mjs", "scripts/generate-embeddings.mjs"]) {
      const src = readFileSync(path.join(root, f), "utf8");
      expect(src, `${f} 不再调用 loadLocalEnv：上面那条判据会因为谓词失配而空转`).toContain("loadLocalEnv(");
    }
  });

  it("自证：谓词抓得出真实病灶形状，也放过三种合法形状", () => {
    // ① 病灶原形（下标里再套一层方括号）——第一版正则就是在这里失配的
    expect(isHandRolledParser('for (const l of t.split("\\n")) { const m = l.match(re); if (m) process.env[m[1]] = m[2]; }'))
      .toBe(true);
    // ② 简单下标形状同样要抓到
    expect(isHandRolledParser('process.env["X"] = v;')).toBe(true);
    // ③ 真的调用 loadLocalEnv 的同样形状不算违规
    expect(isHandRolledParser('process.env[m[1]] = m[2];\nloadLocalEnv(p);')).toBe(false);
    // ③b 只 import 不调用 —— 依然算违规（判据问的是「走没走这条路」，不是「提没提这个词」）
    expect(isHandRolledParser('import { loadLocalEnv } from "./local-env-lib.mjs";\nprocess.env[m[1]] = m[2];'))
      .toBe(true);
    // ④ 注释里解释这个病怎么写，不算有病（不涂白就会被命中）
    expect(isHandRolledParser('// process.env[KEY] = value 这种写法不要再用\nconst a = 1;')).toBe(false);
    // ⑤ 块注释同理
    expect(isHandRolledParser('/* process.env[KEY] = value */\nconst a = 1;')).toBe(false);
    // ⑥ 读 .env.example 做文档对账、一次都不写 process.env —— 那是另一件事
    expect(isHandRolledParser('const t = fs.readFileSync(f);')).toBe(false);
  });
});
