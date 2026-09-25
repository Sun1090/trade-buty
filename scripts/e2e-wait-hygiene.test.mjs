/**
 * R16.262：e2e 里不许再用 `waitUntil: "networkidle"`。
 *
 * 为什么这条值得钉死：`e2e/full-site.spec.ts` 有 5 处 `page.goto(..., { waitUntil: "networkidle" })`，
 * 把「网络安静 500 毫秒」当成页面就绪的定义。可这些页面自己会一直往第三方端点发请求——
 * 2026-09-25 两遍全量链跑同一份页面代码，一遍绿一遍红：红的那次 60s 测试超时被一个 goto 吃满，
 * 同一次运行的服务端日志里有 `[rag] 检索失败: TypeError: fetch failed`；单独重跑 5.5s 就绿。
 * 也就是说用例的裁决权在 Binance 与上游 AI 端点手里，不在我们手里。
 *
 * 每条 goto 之后要等的东西分两半，各有各的证据：**元素在不在**由那一条断言或 `locator.focus()`
 * 自己轮（Playwright 的 actionability 等待），这一半不需要等网络安静。**按键有没有被接管**则由
 * 断言保证不了——SSR 吐出的 HTML 里按钮就带 `aria-haspopup`、也能 `focus()`，所以「元素在」这个
 * 信号在 React 挂上事件处理器之前就已经亮了，实测去掉 networkidle 后红在这里（见
 * `e2e/full-site.spec.ts` 里 `actUntilTaken` 的注释）。这一半必须走「动作 + 动作的效果」成对重试。
 *
 * 判据的形状沿用同族几条的规矩：**扫描带地板**（文件数掉下来说明扫描本身坏了，不许报「0 处违规」）、
 * **给探测器一条它必须抓到的夹具**（防「永远不匹配」的空转门禁）。
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");

/** 被禁的写法：goto 的选项里等网络安静。注释里提这个词不算（本文件的说明就提了）。 */
const BANNED = /waitUntil:\s*["']networkidle["']/g;

const specFiles = readdirSync(path.join(root, "e2e"))
  .filter((f) => f.endsWith(".spec.ts"))
  .sort();

/**
 * 把注释整块涂白，但保住行号（违规要报出第几行）。
 * 只处理「整行行注释」与「块注释」两种；行尾挂着注释的写法本仓没有，出现了也不算违规，是已知边界。
 */
function blankComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/^\s*\/\/.*$/gm, "");
}

/** 在一份源码里找违规，返回命中处的行号（1 起） */
function findViolations(source) {
  const out = [];
  for (const m of blankComments(source).matchAll(BANNED)) {
    out.push(source.slice(0, m.index).split("\n").length);
  }
  return out;
}

/**
 * 「语句层的裸按键 / 裸点击」：写在测试体那一层（4 空格缩进）、后面不跟接管证据的动作。
 * 只在指定的那一段里找。整行匹配到 `.press(` / `.click(` 为止，所以
 * `await page.getByRole("x").click();` 这种带引号和括号的链式写法也在射程内。
 * 已知边界：这条尺子量的是「测试体那一层（4 空格）」，再往里缩进的动作（`for` 循环里的按键、
 * 或者干脆被人多敲一层空格的）逃得出去——所以它的判据是「语句层没有裸按键」，不是「所有动作都查过」。
 */
function bareActions(source) {
  const out = [];
  source.split("\n").forEach((line, i) => {
    if (/^\s{4}await .*\.(?:press|click)\(/.test(line)) out.push(i + 1);
  });
  return out;
}

/** 从某个标题切到下一个同级标题之前（避免把后面那一族的动作算进来）。 */
function blockOf(src, heading) {
  const start = src.indexOf(heading);
  if (start === -1) return null;
  const rest = src.slice(start);
  const next = rest.indexOf('test.describe(', heading.length);
  return next === -1 ? rest : rest.slice(0, next);
}

describe("e2e 等待卫生：不许把「网络安静」当成页面就绪", () => {
  it(`扫到的 spec 文件不少于地板（${specFiles.length} 份，地板 11）`, () => {
    expect(
      specFiles.length,
      `只扫到 ${specFiles.length} 份 e2e spec，地板以下说明扫描本身坏了，这条「0 违规」不可信`,
    ).toBeGreaterThanOrEqual(11);
    expect(specFiles, "e2e/full-site.spec.ts 不在扫描结果里，路径或后缀变了").toContain("full-site.spec.ts");
  });

  it("没有任何一份 spec 用 waitUntil: networkidle", () => {
    const offenders = [];
    for (const f of specFiles) {
      const hits = findViolations(readFileSync(path.join(root, "e2e", f), "utf8"));
      if (hits.length) offenders.push(`e2e/${f}:${hits.join(",")}`);
    }
    expect(offenders, `这些 goto 在等网络安静：${offenders.join(" ")}`).toEqual([]);
  });

  it("探测器本身抓得住一条已知违规（正向对照）", () => {
    const fixture = 'await page.goto("/zh/replay", { waitUntil: "networkidle" });\n';
    expect(
      findViolations(fixture),
      "探测器匹配不到被禁写法，那上一条「0 违规」就是空转",
    ).toEqual([1]);
    // 反向：注释里出现这个词不算违规
    expect(findViolations("// 不等 networkidle：那会把裁决权交给第三方\n")).toEqual([]);
  });

  it("「语句层的裸按键」探测器抓得住一条已知违规（正向对照）", () => {
    const fixture = '  test("x", async ({ page }) => {\n    await page.keyboard.press("Enter");\n  });\n';
    expect(bareActions(fixture), "探测器匹配不到语句层的裸按键，下面那条「0 裸按键」就是空转").toEqual([2]);
    // 链式写法（改回旧形状时就是这一种）也必须在射程内
    expect(
      bareActions('  test("x", async ({ page }) => {\n    await page.getByRole("button", { name: "开始" }).click();\n  });\n'),
      "探测器只认 `page.keyboard.press` 的话，把 click 退回旧写法就躲过去了",
    ).toEqual([2]);
    // 反向：包在回调里（8 空格）的动作不算
    expect(
      bareActions('  test("x", async ({ page }) => {\n    await actUntilTaken(\n      "a",\n      async () => {\n        await page.keyboard.press("Enter");\n      },\n    );\n  });\n'),
    ).toEqual([]);
  });

  it("Q2.4 一族：没有写在语句层的裸按键，且包起来的动作确实存在", () => {
    const src = readFileSync(path.join(root, "e2e", "full-site.spec.ts"), "utf8");
    expect(src, "R16.262 的说明被删了——把理由写回注释或删掉这条判据，别留成无解释的形状").toContain(
      "一律不等 `networkidle`",
    );
    const block = blockOf(src, 'test.describe("Q2.4 核心交互无障碍"');
    expect(block, "找不到 Q2.4 那一族，这一条判据的范围已经空了").not.toBeNull();
    const lines = block.split("\n");
    const gotos = lines.filter((l) => /^\s*await page\.goto\(/.test(l)).length;
    expect(gotos, "Q2.4 里已经没有 goto 了，这条判据要跟着改").toBeGreaterThanOrEqual(5);
    const bare = bareActions(blankComments(block));
    expect(bare, `这些动作写在语句层，断言等得到元素、等不到接管：Q2.4 内第 ${bare.join(",")} 行`).toEqual([]);
    const wrapped = lines.filter((l) => /await actUntilTaken\(/.test(l)).length;
    expect(
      wrapped,
      "Q2.4 里没有（或少于）包起来的动作了：上一条只数「有没有裸按键」，把动作整段删掉也能绿，所以这里数反向的证据",
    ).toBeGreaterThanOrEqual(3);
  });

  it("接管判据自己真的是在重试「动作 + 效果」，不是一句空函数", () => {
    const src = readFileSync(path.join(root, "e2e", "full-site.spec.ts"), "utf8");
    const body = blockOf(src, "async function actUntilTaken(");
    expect(body, "actUntilTaken 没了或被改了名——这一族的接管证据就没有落脚点了").not.toBeNull();
    expect(body, "退化成只等断言，等于回到「元素在 = 接管了」那个错的推论").toContain(".toPass(");
    expect(body, "动作没有在效果断言之前跑，重试就只是在等同一个断言").toMatch(
      /await act\(\)[\s\S]{0,40}await expectEffect\(\)/,
    );
  });
});
