/**
 * R16.323：注释里那些「当场量的条数」不能写成现在时。
 *
 * **病灶不是笔误，是一类特定的失效**：注释说「实测把 X 改成 12h，本模块 12 条用例全绿」（修复前的原文），
 * 那个 12 是**某一次测量的读数**，不是代码的属性。任何人往那个文件里加一条用例，这句话
 * 就在无人察觉的情况下变成假话——而它读起来像真话，因为它就长在解释「为什么要立这道判据」
 * 的位置上。本轮普查（`.gate-logs/survey-r77c.mjs`）扫 `src/` + `scripts/` 全部 720 份
 * 文件，量出 **15 行**这类读数，其中 **11 行没有标时间**；收窄形状后真病灶是 **6 行**（5 行读数 + 1 行清点），其中 3 行是**我自己在
 * 第七十五、七十六轮写下的**（`ai-quiz.test.tsx` 当时写的「本文件 14 条全绿」、`study-caps.test.ts`
 * 的两条）——上一轮刚给「单次调用没有上限」那句假话关账，同一轮就自己长了三句新的。
 *
 * **当场复算的读数**（这些是本轮改之前的事实）：
 * - `study-time.test.ts` 现在 14 条（注释写 12）；
 * - `ai-quiz.test.tsx` 现在 15 条（注释写 14——因为 R16.322 给它补了那条行为判据）；
 * - `study-caps.test.ts` 现在 5 条（注释写 4）。
 * 三条都是「加用例的人没错，注释自己骗人」。
 *
 * **判据为什么只看「有没有标时间」而不核对条数**：条数要跑 vitest 才知道，把它放进单测
 * 就是让一道单测去等另一道单测（R16.301 那条「门禁自己超时等于没有门禁」的同族）。
 * 标了时间（当时 / 修复前 / 本轮 / 登记时 / R16.xxx / 以前）的读数是**历史快照**，
 * 它说的是「那时候量到几」，永远为真；没标时间的读数是**现在时的承诺**，没人核。
 * 所以这条门禁管的是时态，不是数值。
 *
 * 运行：`npx vitest run scripts/comment-measurement-claims.test.mjs`（跟随 `npm test`）
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");

/**
 * 形状 A：一条注释里的「测量读数」——一个数 + 量词 + 绿/红这类**测量结论**。
 * 结论词表里刻意**不放**「通过」：那三个 `0 处问题被打印成绿色通过` 之类的句子说的是
 * 门禁自己的输出行为（「扫到 0 处就会绿」是一条关于空转的真话，不随用例增删变），
 * 把它们收进来是误伤。第一版就误伤了 3 行，靠这一条收窄修掉。
 */
const READING = /\d+\s*(?:条|处|个|篇|组|文件)[^。，\n]{0,12}(?:全绿|全红|照样全绿|都会红|会红|不红)/g;

/**
 * 形状 B：现在时的**清点**——「现有 / 共有 / 总共 / 合计 N 条」。
 * 它不引用测量，但它承诺的是「此刻有几个」，同样会随增删变。本轮普查时人口为 1，
 * 而且那 1 处正是我自己刚写下的（`study-time.ts` 那句 R16.322 时的「本模块现有 14 条用例」）。
 */
const INVENTORY = /(?:现有|共有|总共|合计)\s*\d+\s*(?:条|处|个|篇|组|文件)/g;

/** 把读数锚回某一时刻的说法——有任意一个就算标了时间 */
const SNAPSHOT = /当时|修复前|本轮|登记时|那一次|以前|此前|原先|立判据之前|R16\.\d+/;

/**
 * 这一行是不是「没标时间的读数」。
 * **必须走这个函数，不要直接拿 `READING.test(line)`**：两条形状正则都带 `g`，
 * 而 `/g` 的 `.test()` 有状态（每次调用推进 `lastIndex`），同一行连测两次第二次就会
 * 假阴性——自证那一段第一版就是这么「绿」的，它测的是自己，绿得毫无意义。
 */
function unanchoredReadings(line) {
  if (SNAPSHOT.test(line)) return [];
  return [...(line.match(READING) ?? []), ...(line.match(INVENTORY) ?? [])];
}

/** 注释行（行注释、块注释起始、块注释中间的 ` * `） */
const COMMENT = /^\s*(?:\/\/|\/\*|\*\s?|\*\/)/;

/** 非测试源码与测试源码都算：读数两边都会写 */
function listFiles() {
  return execFileSync("git", ["ls-files", "--cached", "--exclude-standard"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => /^(src|scripts)\//.test(f) && /\.(ts|tsx|mjs)$/.test(f));
}

function findings() {
  const hits = [];
  const files = listFiles();
  for (const rel of files) {
    let src;
    try {
      src = readFileSync(path.join(root, rel), "utf8");
    } catch {
      continue; // 未跟踪又被删掉的空位，跳过
    }
    src.split("\n").forEach((line, i) => {
      if (!COMMENT.test(line)) return;
      const readings = unanchoredReadings(line);
      if (readings.length === 0) return;
      hits.push({ rel, at: i + 1, readings, text: line.trim().slice(0, 100) });
    });
  }
  return hits;
}

describe("注释里的测量读数必须标时间", () => {
  it("扫描面非空：至少扫到 500 份源码", () => {
    expect(listFiles().length, "扫不到文件就是扫描器坏了，这条门禁会空转").toBeGreaterThanOrEqual(500);
  });

  it("这条判据抓得住「没标时间的读数」——自证，否则「没命中」与「判据没牙」读起来一样", () => {
    const CAUGHT = [
      " * 不可观察——实测把任一处改成 12h，`study-time.test.ts` 12 条全绿。",
      " * 实测把它改成 120 秒，本文件 14 条全绿。",
      "  // 把那一处删掉，那 6 条照样全绿。",
    ];
    // 形状 B：现在时的清点
    expect(unanchoredReadings(" * 本模块现有 14 条用例。").length, "形状 B 没抓到").toBeGreaterThan(0);
    expect(unanchoredReadings(" * 当时本模块 14 条用例。"), "形状 B 误伤历史快照").toEqual([]);
    // 误伤自证：门禁输出行为不是测量读数，别把它当病抓
    // 这两行是**第一版误伤**的三行里的两行：把它们写成「期望为空」是空转，
    // 所以另加一条——用第一版那个没收窄的形状去量，它们必须命中。
    // 这才说明「不收窄会误伤」是量出来的，不是我事后编的理由。
    const LOOSE_V1 = /\d+\s*(?:条|处|个|篇|组|文件)[^。\n]{0,14}(?:全绿|全红|照样全绿|都会红|会红|通过|不红)/g;
    const benign = [
      ' * 空数组，于是「0 处问题」被打印成绿色通过。',
      ' * 待扫集合是空的，「0 处发现」会被打印成通过。',
    ];
    for (const line of benign) {
      expect(unanchoredReadings(line), `误伤门禁输出行为：${line}`).toEqual([]);
      expect([...line.matchAll(LOOSE_V1)].length, `第一版形状抓不到它，那「收窄」这条自证是空转：${line}`).toBeGreaterThan(0);
    }
    const MISSED = [
      " * 修复前实测把任一处改成 12h，当时 12 条全绿。",
      " * 本轮把它改成 120 秒，该文件当时 14 条全绿（R16.322）。",
      " * 登记时那 16 条的分布是 6 / 3 / 1 / 6。",
    ];
    for (const line of CAUGHT) {
      expect(unanchoredReadings(line).length, `该抓没抓：${line}`).toBeGreaterThan(0);
    }
    for (const line of MISSED) {
      expect(unanchoredReadings(line), `误伤历史快照：${line}`).toEqual([]);
    }
  });

  /**
   * 自覆盖：主判据必须**真的把扫描结果喂进一条断言**。
   * 由来是探针 M5——把 `.toEqual([])` 摘掉之后，扫描照跑、地板照绿、自证照绿，
   * 整道门禁静默变成一句空话，而**没有任何东西能喊**。这条就是补那个位置：
   * 它不判内容，只判「这条门禁还接着它的判据」。
   */
  it("主判据的接线还在：扫描结果被喂进一条断言", () => {
    const self = readFileSync(path.join(root, "scripts", "comment-measurement-claims.test.mjs"), "utf8");
    const main = self.slice(self.indexOf('it("全仓没有一处把测量读数写成现在时"'));
    expect(main.length, "主判据那条 it 不见了").toBeGreaterThan(0);
    expect(main.includes("findings()"), "主判据不再调用 findings()，扫描被摘干净了").toBe(true);
    expect(/expect\(\s*hits[\s\S]{0,300}?\.toEqual\(\[\]\)/.test(main), "扫描结果没被喂进断言：这条门禁在空转").toBe(true);
  });

  it("全仓没有一处把测量读数写成现在时", () => {
    const hits = findings();
    expect(
      hits,
      `这些注释把某一次测量的条数写成了现在时的承诺（加一条用例它就变假话）。` +
        `要么标上时间（当时 / 修复前 / R16.xxx），要么改成点名用例标题而不是数条数：\n` +
        hits.map((h) => `  ${h.rel}:${h.at}  [${h.readings.join(", ")}]  ${h.text}`).join("\n"),
    ).toEqual([]);
  });
});
