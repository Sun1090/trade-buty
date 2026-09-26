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
 * 行首的空格只能用 `[ \t]*`：写成 `\s*` 时那个 `\s` 会把换行也吃掉，注释行上面那些空行连同注释
 * 一起消失，行数就变了——第三十八轮被「台账点名的行号要对回尺子现读的集合」这条判据当场抓出来
 * （`full-site.spec.ts` 554 行被涂成 550 行，于是第 207 行的动作被报成第 206 行）。
 */
function blankComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/^[ \t]*\/\/.*$/gm, "");
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

  it("涂白注释保住行数与行位置，否则报出来的行号是假的", () => {
    // 这个夹具的形状就是第三十八轮踩到的：注释上下都有空行。行首若写成 `\s*`，`\s` 会连换行一起吃，
    // 空行 + 注释一起消失，后面每一行的读数都往前挪一位。
    const fixture = 'const a = 1;\n\n  // 一句说明\n\nawait page.goto("/zh", { waitUntil: "networkidle" });\n';
    expect(
      blankComments(fixture).split("\n").length,
      "涂白之后行数变了——「违规在第几行」这类消息从此不可信",
    ).toBe(fixture.split("\n").length);
    expect(findViolations(fixture), "违规既要数到，也要报在它本来的那一行").toEqual([5]);
  });
});

/**
 * R16.267 收口（第三十八轮）。上一轮那行台账写着「同一个 hazard 还留在另外 29 处语句层动作里」，
 * 并把「先造出失败条件」列为下一步。本轮把失败条件真的造出来了，结论跟那句话相反：
 *
 *   仪器 = `.gate-logs/r38-race-proxy.cjs`，给每个 JS 响应先睡 1500ms 再放行（SSR 的 HTML 照旧秒回，
 *   于是「DOM 早就在、脚本还没接管」这个状态被钉住）。仪器自己验过会咬，而且是 4 次的读数：
 *   同一份课文页夹具在睡着的端口上「裸按一次 Enter」4/4 红，「动作 + 效果成对重试」那版 4/4 绿；
 *   不睡的端口上两版都绿。
 *   读数 = 承载这些动作的 19 条用例，慢侧 18 条绿；点收藏那条先红过一次，再跑 12 次（慢）+ 12 次
 *   （同一份代理不睡，对照）都是 0 红——单次那一下复现不出来，成因未查明。
 *   机制 = 承载动作的这几份文件的 `page.goto()` 全部默认等到 `load`，脚本没到 load 就不点亮，动作
 *   落不到「还没接管」的页面上；把同一套书签步骤只改一个 `waitUntil: "domcontentloaded"`，慢侧 4/4 红。
 *
 * 所以这里钉四件事：**人口**（处数由尺子现读，台账必须等于它；尺子扫的是 `e2e/` 全部 spec，往别的
 * 文件里加动作同样会红在这里）、**台账点名的行号**（每一处都要落在现读集合里）、**那个开关**
 * （承载动作的文件里不许出现不等 `load` 的 goto，出现了本轮的读数就作废）、**本轮真正修掉的那处
 * 空断言**（smoke 的「测验作答闭环」：两处点击删掉仍绿，因为 `/✅|❌/` 一进场就命中课文正文里的清单）。
 *
 * 已知边界（沿用上面 `bareActions` 那条尺子的边界，本轮没有扩大它）：只认恰好 4 空格，所以写在
 * helper 里的动作它数不清属于谁——`expectVisibleFocusRing` 的 `Tab`/`Shift+Tab`（`full-site.spec.ts`
 * 的 70/71 行）与 `dismissOnboarding` 的那颗「跳过引导」（`mobile-overflow.spec.ts:36`）都不在人口里；
 * 同理，「删掉这一句用例还绿不绿」只能量出**用例依不依赖这个动作**，量不到**动作在真实网络上会不会
 * 被吞**——后者要的是上面那台代理。
 */

/** 语句层动作的行号：注释涂白后，恰好 4 空格缩进的 `await ….press(` / `await ….click(` */
function statementActionLines(source) {
  const out = [];
  blankComments(source)
    .split("\n")
    .forEach((line, i) => {
      if (/^ {4}await .*\.(?:press|click)\(/.test(line)) out.push(i + 1);
    });
  return out;
}

/** 承载语句层动作的文件：不写死名单，谁有动作谁就在内——新的宿主文件会自动被人口与开关两条腿管住 */
const HOST_SPECS = specFiles
  .map((f) => ({ f, lines: statementActionLines(readFileSync(path.join(root, "e2e", f), "utf8")) }))
  .filter((r) => r.lines.length > 0);

/** 放宽到 `load` 之前的 goto：那正是接管竞态的开关 */
function earlyGotos(source) {
  return [...blankComments(source).matchAll(/\.goto\([^)\n]*waitUntil:\s*["'](?!load)/g)].map((m) => m[0]);
}

/** 只在「整页找 ✅/❌」这种形状上响：判分文案必须由作答视图自己的容器圈出来 */
function unscopedVerdict(source) {
  return [...source.matchAll(/page\.getByText\(\s*\/[^/]*✅/g)].map((m) => m[0]);
}

function roadmapRow(id) {
  const src = readFileSync(path.join(root, "docs", "roadmap.md"), "utf8");
  const line = src.split("\n").find((l) => new RegExp(`^- \\[[ xX]\\] ${id}\\b`).test(l));
  expect(line, `docs/roadmap.md 里找不到 ${id} 那一行——台账整行没了，靠它签字的判据就成了空转`).toBeTruthy();
  return line;
}

describe("R16.267 收口：语句层动作的人口、那个竞态开关，与本轮真修掉的空断言", () => {
  const perFile = HOST_SPECS;
  const total = perFile.reduce((a, r) => a + r.lines.length, 0);

  it(`探测器认得语句层动作（正向对照），人口也不低于地板（现读 ${total} 处，${perFile.length} 份文件）`, () => {
    expect(
      statementActionLines('  test("x", async ({ page }) => {\n    await page.getByRole("button", { name: "开始" }).click();\n  });\n'),
      "探测器匹配不到链式 click，下面所有数出来的「N 处」都是空转",
    ).toEqual([2]);
    // 反向：包进回调（8 空格）与写在注释里的都不算语句层
    expect(statementActionLines('    // await page.keyboard.press("Enter");\n      await page.keyboard.press("Enter");\n')).toEqual([]);
    expect(perFile.length, `只有 ${perFile.length} 份文件数到语句层动作，低于地板 4：扫描本身坏了`).toBeGreaterThanOrEqual(4);
    expect(total, `语句层动作只剩 ${total} 处，低于地板 29：要么扫描坏了，要么台账要跟着改`).toBeGreaterThanOrEqual(29);
  });

  it("roadmap 的 R16.267 那一行，总数与各文件的处数都等于尺子现读的数", () => {
    const row = roadmapRow("R16.267");
    expect(row, `那一行没写现读的总数 **${total} 处**（尺子数到的是这个数）`).toContain(`**${total} 处**`);
    for (const { f, lines } of perFile) {
      expect(
        row,
        `那一行对 ${f} 写的处数不等于尺子数到的 ${lines.length} 处（现读：${lines.join("/")}）`,
      ).toContain(`${f}\` **${lines.length}**`);
    }
  });

  it("那一行点名的行号，每一处都真的是尺子数到的语句层动作", () => {
    const row = roadmapRow("R16.267");
    const byFile = new Map(perFile.map((r) => [r.f, new Set(r.lines)]));
    let checked = 0;
    let current = null;
    // 逐个 token 走一遍：`xxx.spec.ts` 出现之后，直到下一个文件名之前，`：\`189/207\`` 这类行号
    // 都算在这个文件头上——漂号的行号一定不在该文件现读的集合里。
    for (const m of row.matchAll(/`([\w-]+\.spec\.ts)`|：`(\d+(?:\/\d+)*)`/g)) {
      if (m[1]) {
        current = m[1];
        continue;
      }
      const set = byFile.get(current);
      expect(set, `那一行在没点名文件的情况下写了行号组 ${m[2]}`).toBeTruthy();
      for (const n of m[2].split("/")) {
        checked += 1;
        expect(set, `${current}:${n} 不在尺子现读的语句层动作里（台账的该行号已漂）`).toContain(Number(n));
      }
    }
    expect(checked, "那一行不再点名任何行号，这条比对是空转").toBeGreaterThanOrEqual(10);
  });

  it("承载这些动作的文件里，goto 一律等到 load——放宽就是关掉那台仪器", () => {
    for (const { f } of HOST_SPECS) {
      const src = readFileSync(path.join(root, "e2e", f), "utf8");
      const gotos = [...src.matchAll(/^\s*await page\.goto\(/gm)].length;
      expect(gotos, `${f} 里只数到 ${gotos} 处 goto，这条比对的范围已经空了`).toBeGreaterThanOrEqual(8);
      const early = earlyGotos(src);
      expect(
        early,
        `${f} 出现了不等 load 的 goto（${early.join(" / ")}）：第三十八轮那份「慢脚本下 19 条用例只有 1 次复现不出来的红」的读数不再适用，这一族要重新量`,
      ).toEqual([]);
    }
    // 正向对照：探测器必须认得那个形状，否则上面的「0 处」是空转
    expect(
      earlyGotos('await page.goto("/zh/chart", { waitUntil: "domcontentloaded" });'),
      "探测器匹配不到 domcontentloaded，上一条的「0 处」就是空转",
    ).toHaveLength(1);
    expect(earlyGotos('await page.goto("/zh/chart", { waitUntil: "load" });')).toEqual([]);
  });

  it("smoke 的「测验作答闭环」把判分文案圈在作答视图里，不在整页找 ✅", () => {
    const src = readFileSync(path.join(root, "e2e", "smoke.spec.ts"), "utf8");
    const start = src.indexOf('test("章节页 → 课程页 → 测验作答闭环"');
    expect(start, "找不到那条用例，这条判据的范围已经空了").toBeGreaterThanOrEqual(0);
    // 只取这一条用例的正文：到下一个同级 `test(` 为止
    const rest = src.slice(start);
    const next = rest.indexOf('\n  test(', 10);
    const block = next === -1 ? rest : rest.slice(0, next);
    expect(block, "作答的效果必须被测到：选项点过之后要锁住").toContain("toBeDisabled()");
    expect(block, "判分那一行必须由作答视图自己的容器圈出来").toMatch(/quiz\.getByText\(/);
    // 注释要涂白再看：本轮改口的那段说明里原文引用了被禁的写法
    const code = blankComments(block);
    expect(
      unscopedVerdict(code),
      "又回到 `page.getByText(/✅…/)`：课文正文里那份「✅（已读）」清单会让它一进场就命中，两处点击删掉仍绿",
    ).toEqual([]);
    // 正向对照：探测器必须抓得住退回整页的那种写法
    expect(
      unscopedVerdict('await expect(page.getByText(/✅|❌/).first()).toBeVisible();'),
      "探测器匹配不到整页找 ✅ 的写法，上一条的「0 处」就是空转",
    ).toHaveLength(1);
  });
});
