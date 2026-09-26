/**
 * R16.246：`docs/retention-metrics.md` 那张「修剪策略」表必须逐行对得上实现。
 *
 * 这一张表是仓库里回答「你的数据到底留多久」的地方——隐私页、导出工具、以后任何「留多久」
 * 的争论都引它。它写「无上限」，意思就是这本台账不会被裁；写 90，就得是代码里那个 90。
 * 本轮动手之前它有五处不实（两条键名根本不存在、两条「无上限」其实有裁剪、一条窗口口径
 * 说成了「最近 90 天」而代码锚的是台账最后一天）。判据全部回 `.ts` 现读：读不到实现文件、
 * 数字对不上、或「无上限」那行其实藏着一次裁剪，都当场红。
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "./growth-event-privacy.mjs";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const noBold = (s) => s.replace(/\*\*/g, "");
const flat = (s) => noBold(s).replace(/\s+/g, "");

const doc = read("docs/retention-metrics.md");

/** §2 那张表：{ key, owner, cell, capped } */
function rows() {
  const body = doc.slice(doc.indexOf("## 2."), doc.indexOf("\n## 3."));
  return body
    .split("\n")
    .filter((l) => /^\| `tb-/.test(l))
    .map((l) => {
      const cells = l.split(/(?<!\\)\|/);
      const first = cells[1] ?? "";
      const cell = cells[2] ?? "";
      return {
        key: (/`(tb-[a-z0-9-]+)`/.exec(first) ?? [])[1] ?? "",
        owner: (/`((?:src|scripts)\/[^`]+)`/.exec(first) ?? [])[1] ?? "",
        cell,
        uncapped: cell.includes("无上限"),
        numbers: [...cell.matchAll(/\d+/g)].map((m) => m[0]),
      };
    });
}

/** 实现文件里能站住的上限数字：本文件的常量、`slice(-N)`，以及它相对导入里的同款。 */
function capNumbers(rel, seen = new Set()) {
  if (seen.has(rel)) return new Set();
  seen.add(rel);
  const src = readFileSync(path.join(root, rel), "utf8");
  const nums = new Set();
  for (const m of src.matchAll(/(?:const|let)\s+[A-Z_][A-Z0-9_]*\s*=\s*(\d+)/g)) nums.add(m[1]);
  for (const m of src.matchAll(/slice\(-(\d+)\)/g)) nums.add(m[1]);
  for (const m of src.matchAll(/from\s+"\.\/([\w.-]+)"/g)) {
    const dep = path.join(path.dirname(rel), `${m[1]}.ts`).replace(/\\/g, "/");
    if (existsSync(path.join(root, dep))) {
      for (const n of capNumbers(dep, seen)) nums.add(n);
    }
  }
  return nums;
}

const TRIM_SIGNAL = /slice\(|cutoff|MAX_[A-Z0-9_]*|_KEEP\b/;
const table = rows();

describe("修剪策略表逐行对上实现文件", () => {
  it("每一行都点名的了实现文件，行数不许悄悄变少", () => {
    expect(table.length, "§2 那张表没解析出任何一行").toBeGreaterThanOrEqual(6);
    for (const r of table) {
      expect(r.key, "有一行没写出它的存储键").toBeTruthy();
      expect(r.owner, `${r.key} 那一行没有点名实现文件`).toBeTruthy();
      expect(existsSync(path.join(root, r.owner)), `${r.key} 点名的 ${r.owner} 不存在`).toBe(true);
    }
  });

  for (const r of table) {
    it(`${r.key} 的上限策略就是 ${r.owner} 里做的那些`, () => {
      const src = read(r.owner);
      const trimmed = TRIM_SIGNAL.test(src);
      if (r.uncapped) {
        expect(trimmed, `${r.key} 写着「无上限」，可 ${r.owner} 里有一次裁剪（${src.match(TRIM_SIGNAL)?.[0]}）`).toBe(false);
        expect(r.numbers, `「无上限」那一行还写了数字：${r.numbers.join("、")}`).toEqual([]);
        return;
      }
      expect(trimmed, `${r.key} 给了一道窗口，实现文件里却找不到任何裁剪`).toBe(true);
      expect(r.numbers.length, `${r.key} 那一行一个数都没写，窗口是多少无从查起`).toBeGreaterThan(0);
      const nums = capNumbers(r.owner);
      for (const n of r.numbers) {
        expect(nums.has(n), `${r.key} 那一行的 ${n} 在 ${r.owner}（含它相对导入的文件）里找不到对应的上限`).toBe(true);
      }
    });
  }

  it("「因此」那一段点名的窗口数与无上限数就是表里的", () => {
    const capped = table.filter((r) => !r.uncapped).length;
    const openEnded = table.filter((r) => r.uncapped).map((r) => r.key);
    const para = flat(doc.slice(doc.indexOf("**因此**"), doc.indexOf("\n## 3.")));
    expect(capped, "有窗口的台账少到不正常").toBeGreaterThanOrEqual(3);
    expect(openEnded.length).toBeGreaterThanOrEqual(2);
    expect(para, `正文写的「有窗口」本数不是 ${capped}`).toContain(`${capped}本台账是有窗口的`);
    expect(para, `正文写的「没有裁剪」本数不是 ${openEnded.length}`).toContain(`剩下${openEnded.length}本`);
    for (const key of openEnded) {
      expect(para, `正文那串括号里漏了 ${key}（或写进了其实有裁剪的台账）`).toContain(key);
    }
    expect(noBold(doc).match(/`(tb-[a-z0-9-]+)`/g).length, "文档点名的存储键太少，扫描八成没跑起来")
      .toBeGreaterThanOrEqual(8);
  });

  it("文档点名的每一个存储键都真的在代码里", () => {
    const keys = [...new Set([...doc.matchAll(/`(tb-[a-z0-9-]+)/g)].map((m) => m[1]))];
    expect(keys.length).toBeGreaterThanOrEqual(8);
    const code = [];
    (function walk(dir) {
      for (const e of readdirSync(path.join(root, dir), { withFileTypes: true })) {
        if (e.isDirectory()) walk(`${dir}/${e.name}`);
        else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) code.push(`${dir}/${e.name}`);
      }
    })("src");
    const all = code.map((rel) => read(rel)).join("\n");
    for (const k of keys) {
      expect(all.includes(k), `文档指着 ${k}，src 下（排除测试）没有任何一处用到它`).toBe(true);
    }
  });
});

/**
 * R16.250：§0「为什么没有服务端留存漏斗」的三层理由，每一层都要指着一件当场查得到的东西。
 *
 * 这一节原先的第一句是「平台的隐私宪法（AGENTS.md）要求『无广告、无追踪、无第三方统计脚本』」。
 * 那句引文是造的：`AGENTS.md` 里广告/追踪/统计这三个词一个都没有（中英文都查过），内容宪法谈的是
 * 收益承诺、荐股、开户导流、风险提示与免费，压根不谈遥测。结论本身没错——平台确实没有服务端漏斗——
 * 但它的理由是假引文，而假引文比没有理由更糟：它让「不许上传」这件事看起来只需要相信一句话。
 * 现在三层理由分别落到 plan.md 的某一条、隐私门禁的禁区表、以及依赖清单与 `<script>` 标签的实际数量，
 * 每个数字都由这里现读；「以后接一个统计 SDK」这种改动要过 §0，就得先让这里红一次。
 */
const section0 = () => doc.slice(doc.indexOf("## 0."), doc.indexOf("\n## 1."));
const SDK_TOKENS = [
  "posthog",
  "plausible",
  "matomo",
  "piwik",
  "umami",
  "fathom",
  "amplitude",
  "mixpanel",
  "segment",
  "googletagmanager",
  "google-analytics",
  "gtag",
  "hotjar",
  "clarity",
  "appmetrica",
  "snowplow",
  "countly",
  "heap",
];

describe("§0 的三层理由各自查得到", () => {
  const s0 = noBold(section0());

  it("第 1 层：引文就是内容宪法的第 N 条，一字不差", () => {
    const m = /§内容宪法第 (\d+) 条原文「([^」]+)」/.exec(s0);
    expect(m, "§0 不再用「内容宪法第 N 条原文『…』」这个形状了，同步这里").toBeTruthy();
    const items = (() => {
      const plan = read("docs/plan.md");
      const body = plan.slice(plan.indexOf("## 内容宪法"), plan.indexOf("\n## ", plan.indexOf("## 内容宪法")));
      return body.split("\n").filter((l) => /^\d+\.\s/.test(l)).map((l) => l.replace(/^\d+\.\s*/, ""));
    })();
    expect(items.length, "docs/plan.md 的内容宪条目少到不正常").toBeGreaterThanOrEqual(5);
    expect(flat(items[Number(m[1]) - 1]), `§0 写的条号是第 ${m[1]} 条，plan.md 那一头的第 ${m[1]} 条是「${items[Number(m[1]) - 1]}」`).toBe(flat(m[2]));
    // 「内容宪法管的是收益承诺、荐股、开户导流、风险提示与免费」这句枚举必须与条数等长，
    // 且每个词都真在宪法里出现（取前两字：宪法原文写「不承诺、不暗示任何收益」，文档压缩成了「收益承诺」）
    const enumM = /内容宪法管的是([^，。；]+(?:、[^，。；]+)*(?:与|和)[^，。；]+)/.exec(s0);
    expect(enumM, "§0 不再枚举内容宪法管的是什么，那句「压根不谈遥测」就没了对照").toBeTruthy();
    const topics = enumM[1].split(/[、与和]/).filter(Boolean);
    expect(topics.length, `§0 枚举了 ${topics.length} 项，宪法却有 ${items.length} 条`).toBe(items.length);
    for (const t of topics) {
      expect(items.some((it) => flat(it).includes(flat(t.slice(0, 2)))), `§0 说宪法管「${t}」，五条里没有一个字对得上`).toBe(true);
    }
  });

  it("第 2 层：禁区类数与那份括号就是 growth-event-privacy 里的", () => {
    const privacy = read("scripts/growth-event-privacy.mjs");
    const block = privacy.slice(privacy.indexOf("FORBIDDEN_SINKS"), privacy.indexOf("];", privacy.indexOf("FORBIDDEN_SINKS")));
    const entries = [...block.matchAll(/\[\s*"([^"]+)",\s*\/([^/]+)\//g)].map((m) => ({ label: m[1], re: m[2] }));
    expect(entries.length, "没读到 FORBIDDEN_SINKS 的条目").toBeGreaterThanOrEqual(6);
    const n = /禁区枚举成 (\d+) 类出口/.exec(s0);
    expect(n, "§0 不再写「禁区枚举成 N 类出口」").toBeTruthy();
    expect(Number(n[1]), `§0 写的禁区类数是 ${n[1]}，门禁里其实是 ${entries.length}`).toBe(entries.length);
    // 括号里点名的那几个 API 必须是代码真的禁的（中文那三条是对正则的意译，这里只核对得上的 ASCII）
    const paren = /禁区枚举成 \d+ 类出口（([^）]+)）/.exec(s0.replace(/\n/g, ""));
    expect(paren, "§0 那个数字后面没有括号列举，读者无从核对是哪 6 类").toBeTruthy();
    for (const api of [...paren[1].matchAll(/`([A-Za-z][A-Za-z0-9.]*)`/g)].map((m) => m[1])) {
      expect(
        entries.some((e) => e.re.includes(api)),
        `§0 把 ${api} 列为禁区，FORBIDDEN_SINKS 里没有任何一条正则认它`,
      ).toBe(true);
    }
    expect(paren[1].split(/[、，,]/).length, `括号里列举的出口条数不是 ${entries.length}`).toBe(entries.length);
    // 「整个模块只有一个 console.info 落点」——判据这么要求，代码也确实只有一个
    expect(/loggerCalls\.length\s*!==\s*1/.test(privacy), "隐私门禁已经不要求单一 console.info 落点了").toBe(true);
    const outlet = (stripComments(read("src/lib/growth-events.ts")).match(/console\s*\.\s*info\s*\(/g) ?? []).length;
    expect(outlet, `src/lib/growth-events.ts 里有 ${outlet} 个 console.info，§0 那句「只有一个」不成立`).toBe(1);
  });

  it("第 3 层：运行时依赖里没有统计 SDK，脚本标签数是那个数且全不带 src", () => {
    const pkg = JSON.parse(read("package.json"));
    const deps = Object.keys(pkg.dependencies);
    const m = /`dependencies`（(\d+) 个运行时依赖）里没有任何统计 SDK/.exec(s0.replace(/\n/g, ""));
    expect(m, "§0 不再写运行时依赖的个数，或措辞变了").toBeTruthy();
    expect(Number(m[1]), `§0 写 ${m[1]} 个运行时依赖，package.json 里是 ${deps.length} 个`).toBe(deps.length);
    expect(deps.length, "运行时依赖少到扫描没跑起来").toBeGreaterThanOrEqual(10);
    expect(SDK_TOKENS.length, "统计 SDK 名单缩到不如一份真实的依赖树").toBeGreaterThanOrEqual(15);
    for (const d of deps) {
      for (const t of SDK_TOKENS) {
        expect(d.toLowerCase().includes(t), `§0 说没有统计 SDK，${d} 却匹配了名单里的 ${t}`).toBe(false);
      }
    }
    // 正向对照：把 posthog 塞进这份名单，同一个判据必须报出来
    const caught = ["next", "react", "posthog-js"].filter((d) => SDK_TOKENS.some((t) => d.toLowerCase().includes(t)));
    expect(caught.length, "伪造一份带统计 SDK 的依赖清单都没被查出来，名单废了").toBe(1);

    const files = [];
    (function walk(dir) {
      for (const e of readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) files.push(rel);
      }
    })("src");
    expect(files.length, "src 下的非测试源码少到不正常").toBeGreaterThanOrEqual(200);
    // 注释里那些「`<script` 挡不住」的说明不算标签：先剥注释再数
    const tags = [];
    for (const rel of files) {
      const code = stripComments(read(rel));
      for (const t of code.matchAll(/<script(?=[\s/>])[\s\S]{0,160}/g)) tags.push({ rel, tag: t[0] });
    }
    const claimed = /只剩 (\d+) 处 `<script>` 标签/.exec(s0.replace(/\n/g, ""));
    expect(claimed, "§0 不再写 `<script>` 标签的处数").toBeTruthy();
    expect(Number(claimed[1]), `§0 写 ${claimed[1]} 处，实际是 ${tags.length} 处：${tags.map((t) => t.rel).join("、")}`).toBe(tags.length);
    const withSrc = tags.filter((t) => /^<script[^>]*\ssrc\s*=/i.test(t.tag.replace(/\n/g, " ")));
    expect(withSrc.length, `有一句 <script> 带了 src 属性，§0 那句「全是内联的」不成立：${withSrc.map((t) => t.rel).join("、")}`).toBe(0);
    // 正向对照：一行 GTM 必须被同一个判据抓住
    const gtm = `<script src="https://www.googletagmanager.com/gtm.js?id=GTM-XXXX"></script>`;
    expect(/^<script[^>]*\ssrc\s*=/i.test(gtm), "第三方脚本的识别形状废了").toBe(true);
  });
});

/** 本文点名的路径与台账号都得查得到——§0 新写了「见 R16.250」，这类引用不能是幽灵。 */
describe("本文点名的路径与 roadmap 编号都还在", () => {
  it("路径存在、R 编号在 roadmap 里", () => {
    const paths = [...new Set([...doc.matchAll(/`((?:src|scripts|docs|\.github)\/[^`\s]*)`/g)].map((m) => m[1]))]
      .filter((p) => !p.includes("*") && !p.includes("...") && !p.includes("**"));
    expect(paths.length, "文档一个路径都没点到").toBeGreaterThanOrEqual(4);
    for (const p of paths) expect(existsSync(path.join(root, p)), `文档指着 ${p}，仓库里没有`).toBe(true);
    const roadmap = read("docs/roadmap.md");
    const ids = [...new Set([...doc.matchAll(/\bR\d+\.\d+\b/g)].map((m) => m[0]))];
    expect(ids.length, "文档不再引用任何台账号，扫描八成被改空了").toBeGreaterThanOrEqual(3);
    for (const id of ids) expect(roadmap, `${id} 在 roadmap 里查无此项`).toContain(id);
  });
});

/**
 * R16.251：§1 那张「指标定义」表逐条对上算它的那段代码。
 *
 * §2（修剪策略）在 R16.246 已经逐行钉回实现文件，§1 却一直是这套指标的“散文版”，没人对着查过。
 * 本轮读下来四处不实：①活跃学习日写「任选来源（read/quiz/replay）合计 ≥ 60 秒」——代码取的是
 * `Math.max(read, quiz + replay)`（阅读计时与做题可能同时在进行，R4.2 的去重约定），「读 40 秒 +
 * 测验 30 秒」按文档算一天，按代码不算；②同一行还留着「90 天滚动」，而 R16.246 刚把 §2 那一行
 * 改成「锚在台账里最新有记录的那一天」，两节自相矛盾；③streak 行把 `saveQuizProgress` 列成
 * `touchStreak` 的落笔方，而它从头到尾没碰过 streak（真落笔处是 progress/wrongbook/progress-helpers
 * 三个文件）；④「间断即 current 归零」漏了 `GRACE_MS` 那 36 小时宽限窗（R4.8），跨时区回来那天
 * 其实还连着。判据按代码现读：数字、那份去重表达式、宽限小时数、落笔文件集合，全部回 `.ts` 取。
 */
const WK = "src/lib/weekly-summary.ts";
const ST = "src/lib/study-time.ts";
const SK = "src/lib/streak.ts";
const I18N = "src/lib/i18n-stats.ts";
const CLIENT = "src/components/stats-client.tsx";
const REVIEW = "src/components/review-client.tsx";

/** §1 那张表：{ name, def, source, visible }（表头与分隔行剔掉） */
function metricRows() {
  const body = doc.slice(doc.indexOf("## 1."), doc.indexOf("\n## 2."));
  return body
    .split("\n")
    .filter((l) => /^\|/.test(l) && !/^\|\s*-{3,}/.test(l))
    .map((l) => {
      const c = l.split(/(?<!\\)\|/).map((s) => s.trim());
      return { name: c[1], def: c[2], source: c[3], visible: c[4], raw: l };
    })
    .filter((r) => r.name && r.name !== "指标");
}

const METRICS = metricRows();
const metricOf = (label) => {
  const row = METRICS.find((r) => r.name.includes(label));
  expect(row, `§1 那张表里再也没有「${label}」这一行了——措辞变了要同步这里`).toBeTruthy();
  return row;
};

/** 顶层函数体：从 `function name(` 那行到下一个顶格 function（或文件末） */
function fnBody(file, name) {
  const lines = read(file).split("\n");
  const start = lines.findIndex((l) => new RegExp(`^(?:export )?(?:async )?function ${name}\\(`).test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (/^(?:export )?(?:async )?function /.test(lines[i])) { end = i; break; }
  return lines.slice(start, end).join("\n");
}

/** 该函数是否（同文件内 ≤3 跳）落到 `touchStreak()` */
function reachesStreak(file, name, seen = new Set()) {
  if (seen.has(name)) return false;
  seen.add(name);
  const body = fnBody(file, name);
  if (body === null) return false;
  if (/touchStreak\s*\(/.test(body)) return true;
  const locals = [...read(file).matchAll(/^(?:export )?(?:async )?function ([A-Za-z0-9_]+)\(/gm)].map((m) => m[1]);
  return locals.some((n) => n !== name && new RegExp(`\\b${n}\\s*\\(`).test(body) && reachesStreak(file, n, seen));
}

describe("§1 指标定义逐条对上算它的代码", () => {
  it("表还在，四列都填了", () => {
    expect(METRICS.length, "§1 那张表少到不正常").toBeGreaterThanOrEqual(9);
    for (const r of METRICS) {
      for (const [col, v] of Object.entries({ def: r.def, source: r.source, visible: r.visible })) {
        expect(v, `「${r.name}」那一行的 ${col} 列是空的`).toBeTruthy();
      }
    }
  });

  it("活跃学习日：门槛是那个常量，尺子是去重后的 max，不是三源相加", () => {
    const row = metricOf("活跃学习日");
    const cap = /export const ACTIVE_DAY_MIN_SECONDS = (\d+)/.exec(read(WK));
    expect(cap, `${WK} 里读不到 ACTIVE_DAY_MIN_SECONDS`).toBeTruthy();
    expect(row.def, `那一行写的门槛不是 ${cap[1]} 秒`).toContain(`ACTIVE_DAY_MIN_SECONDS = ${cap[1]}`);
    // 代码里当日总秒数是怎么算出来的，就要求文档怎么写
    const total = /total:\s*Math\.max\(([^)]+)\)/.exec(read(ST));
    expect(total, `${ST} 里的当日 total 不再是 Math.max(...) 这把尺了，文档与判据都要同步`).toBeTruthy();
    expect(row.def, `文档没有点名去重式 max(${total[1]})，读者会以为三源相加`).toContain(`max(${total[1]})`);
    // 禁的是「定义那一句」（第一个句号之前）回到加法说法；后面交代错误来源的句子不受限
    const defHead = row.def.split("。")[0];
    expect(/任选来源|合计/.test(defHead), "那一行的定义本身又写成相加了：代码取的是 max，不是相加").toBe(false);
    // 摘要卡那句 UI 文案与这一行必须同尺（{d} 天各学满 {min} 分钟）
    const tpl = /weekSummaryTpl: `([^`]*)`/.exec(read(I18N));
    expect(tpl, `${I18N} 里读不到周摘要模板`).toBeTruthy();
    const fragment = (tpl[1].match(/\{d\}[^·]*\{min\}[^·]*/)?.[0] ?? "").trim();
    expect(fragment, "UI 那句里没有「{d} … {min}」这把槛，文档引它做什么").toBeTruthy();
    expect(row.visible, `那一行的「可见位置」没有照抄 UI 的尺子「${fragment}」`).toContain(fragment);
    expect(
      /replace\("\{min\}", String\(ACTIVE_DAY_MIN_SECONDS \/ 60\)\)/.test(read(CLIENT)),
      `${CLIENT} 不再把 {min} 由 ACTIVE_DAY_MIN_SECONDS 代入，那句「各学满 N 分钟」已经没人管了`,
    ).toBe(true);
  });

  it("活跃学习日：窗口锚在台账最后一天，不是今天往前 N 天（与 §2 同一份说法）", () => {
    const row = metricOf("活跃学习日");
    const keep = /export const STUDY_LEDGER_KEEP_DAYS = (\d+)/.exec(read(ST));
    expect(keep, `${ST} 里读不到保留天数`).toBeTruthy();
    expect(row.source, `那一行的窗口说法里没有「${keep[1]}」这个数，也无从核对`).toContain(keep[1]);
    expect(row.source.includes("90 天滚动") || /滚动/.test(row.source), "那一行又写成「滚动」了：裁剪锚的是台账里最新有记录的那一天（见 §2），不是今天往前").toBe(false);
    expect(row.source, "那一行没说清锚是哪一天，与 §2 的口径接不上").toContain("最新有记录");
  });

  it("streak：宽限窗的小时数、幂等、以及真正落笔的那几个文件", () => {
    const row = metricOf("连续学习天数");
    const grace = /const GRACE_MS = (\d+) \* 3600_000/.exec(read(SK));
    expect(grace, `${SK} 里读不到 GRACE_MS`).toBeTruthy();
    expect(Number(grace[1])).toBeGreaterThanOrEqual(1);
    expect(row.def, `那一行没提 ${grace[1]} 小时的宽限窗，会把跨时区回来那天说成断签`).toContain(`GRACE_MS = ${grace[1]}`);
    expect(/if \(data\.lastDate === today\) return;/.test(read(SK)), "同一天再记不增天数这件事，代码已经不这么写了").toBe(true);

    const files = [];
    (function walk(dir) {
      for (const e of readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) files.push(rel);
      }
    })("src");
    const writers = files.filter((rel) => rel !== SK && /touchStreak\s*\(/.test(stripComments(read(rel))));
    expect(writers.length, "一个 touchStreak 的调用方都没扫到，判据空转").toBeGreaterThanOrEqual(2);
    for (const rel of writers) {
      expect(row.source, `${rel} 会落笔写 streak，文档那一行没点它`).toContain(path.basename(rel));
    }
    // 文档点名的每个函数要么真的（经 ≤3 跳）落到 touchStreak，要么被明说「不碰它」
    for (const [, fn] of row.source.matchAll(/`([a-z][A-Za-z0-9_]+)`/g)) {
      if (fn.endsWith(".ts") || fn.includes(".")) continue;
      const owner = files.find((rel) => fnBody(rel, fn) !== null);
      if (!owner) continue;
      const denied = new RegExp("不碰它").test(row.source) && row.source.includes(`\`${fn}\``) && row.source.split(`\`${fn}\``)[1].startsWith(" 不碰");
      expect(
        denied || reachesStreak(owner, fn),
        `那一行说 ${fn} 落笔写 streak，可 ${owner} 里的 ${fn} 三跳之内碰不到 touchStreak`,
      ).toBe(true);
    }
    // 本轮改掉的那个假落笔方：它自己与它调的东西都不碰 streak
    expect(reachesStreak("src/lib/quiz-store.ts", "saveQuizProgress"), "saveQuizProgress 现在真的会写 streak 了，文档那句「不碰它」要改").toBe(false);
    expect(row.source, "那一行不再点 saveQuizProgress，读的人无从知道它不算").toContain("saveQuizProgress");
  });

  it("回访这一行说清是哪一份导出算得出来", () => {
    const row = metricOf("回访");
    expect(read("src/lib/privacy-export.ts"), "隐私导出不再整份 dump localStorage，那句「可自算」要重看").toContain("collectLocalStorage(");
    const stats = read("src/lib/stats-export.ts");
    expect(/getStudySeries|studyDays|byDay/.test(stats), "统计导出如今带逐日秒数了，那一行说它算不出是错的").toBe(false);
    expect(stats, "统计导出不再有 studySeconds，那一行引它做什么").toContain("studySeconds");
    expect(row.visible, "那一行没点名是哪一份导出可自算").toContain("隐私导出");
    expect(row.visible, "那一行没说明统计导出算不出「哪几天」").toContain("算不出");
  });

  it("目标档位、默认值与那个界面标签都由代码说了算", () => {
    const row = metricOf("近 7 天目标达成");
    const tiers = /export const WEEKLY_GOAL_TIERS = \[([\d, ]+)\]/.exec(read(WK));
    expect(tiers, `${WK} 里读不到档位表`).toBeTruthy();
    const list = tiers[1].split(",").map((s) => s.trim()).filter(Boolean);
    expect(row.def, `那一行写的档位不是 ${list.join("/")}`).toContain(list.join("/"));
    const dflt = /export const DEFAULT_WEEKLY_GOAL_MIN = (\d+)/.exec(read(WK));
    expect(row.def, `那一行写的默认目标不是 ${dflt[1]}`).toContain(`默认 ${dflt[1]}`);
    const days = /export const WEEK_WINDOW_DAYS = (\d+)/.exec(read(WK));
    expect(row.def, `界面标签不是「${days[1]} 天目标」`).toContain(`${days[1]} 天目标`);
    expect(new RegExp(`weekGoalLabel: \`\\$\\{WEEK_WINDOW_DAYS\\} 天目标\``).test(read(I18N)), "标签不再是 WEEK_WINDOW_DAYS 生成的「N 天目标」").toBe(true);
    expect(read(I18N), "中英字典里又出现了「每周目标」这种日历周说法").not.toMatch(/每周目标/);
  });

  it("出口一致性：那个审计器在、只在开发/测试期告警、而且有单测", () => {
    const row = metricOf("出口一致性");
    expect(/export function auditStatsConsistency\(/.test(read("src/lib/stats-consistency.ts")), "auditStatsConsistency 不再是那个名字了").toBe(true);
    expect(row.source, "那一行没点名 auditStatsConsistency").toContain("auditStatsConsistency");
    const client = read(CLIENT);
    expect(client.includes("auditStatsConsistency("), "统计页已经不跑这个对账了").toBe(true);
    expect(
      /process\.env\.NODE_ENV === "production"[^\n]*return;/.test(client),
      "对账不再由 production 提前返回挡着了，那句「开发期 console 告警」不成立",
    ).toBe(true);
    expect(existsSync(path.join(root, "src/lib/stats-consistency.test.ts")), "那句「+ 单测」没有对应的文件").toBe(true);
    expect(row.visible, "那一行的可见位置没写它是告警而不是界面").toContain("console");
  });

  it("§1「复习暴露率」点名的两个表面都在，复习页那一个中英各插一次到期数", () => {
    const row = metricOf("复习暴露率");
    // 表面一：统计页那条横幅——文案里插的就是到期数，不插它这条「暴露」无从谈起
    expect(
      stripComments(read(CLIENT)),
      "统计页那条提醒横幅不再把到期数插进文案，§1 那句「周/日提醒横幅」没了主人",
    ).toMatch(/reminderBodyTpl\.replace\("\{n\}", String\(dueReviewCount\)\)/);
    // 表面二：复习页顶部那一行。原文只点了英文那个表面（「英 review-wide due chip」），
    // 而中文分支同样把数报了出来——只点名一边，读的人就会以为中文侧到期了看不见。
    expect(row.visible, "那一格不再点名复习页那个表面，读者不知道到期了会在哪看见").toContain("复习页顶部");
    expect(row.visible, "那一格不再交代那一行的前提（报不报数由「复习计划」那个开关决定）").toContain("复习计划");
    const review = stripComments(read(REVIEW));
    expect(
      review,
      "复习页的「复习计划」不再是默认开着，那句「默认是开的」得改",
    ).toMatch(/\[srsOn, setSrsOn\] = useState\(true\)/);
    expect(
      dueBothLocales(review),
      "复习页顶部那一行不再是「一个 locale 三元、两个分支各插一次 ${dueCount}」，§1 那句「中文侧那一行同样报数」要重看",
    ).toBe(true);
    // 正向对照：探测器必须认得「只有一支报数」那个形状——那一支正是本轮改掉的说法
    expect(
      dueBothLocales('  const s = locale === "en"\n    ? `${dueCount} due now`\n    : `${items.length} 道错题`;'),
      "探测器把「只有英文报数」也认成双语，上面那个 true 就是空转",
    ).toBe(false);
    expect(
      dueBothLocales('  const s = locale === "en"\n    ? `${dueCount} due now`\n    : `${dueCount} 道今日到期`;'),
      "探测器连真双语那一支都认不出",
    ).toBe(true);
  });
});

/**
 * R16.271：§3「无登录完全对等」与 §4 那份清单。
 *
 * §3 原先只有两句话，其中一句是假的。「未登录用户与登录用户得到完全相同的指标可见性」——登录后统计页
 * 明明多出两处东西（数据来源标识、「上次从云端合并」卡），而 `hydrateFromCloud()` 还会把云端数据并回
 * 七个本地键，其中一个正是 §1 那把目标档位；「登录只改变『同步到哪台设备』」把这件事整个漏了。两句
 * 也都没说在哪个层面成立，读者无从查证。现在这一节讲的是能被代码否证的东西：算指标的那批模块零处读
 * 登录态、零处自己发请求；整页消费 `useAuth()` 的落点数就是文中那个数，且每一处都落在同步状态那几个
 * 字典字段上；登录写回的键逐个点名，与 `hydrateFromCloud` 的写入端一一对上。文中四个数（键数、处数、
 * 写回键数、清单里那两个窗口数）全部现读，写死一个就红一个。
 */

/** 一段代码里作为存储键用到的字符串：字面量、模板串（`${}` 归一成 `<chapter>`）、同作用域的 const。 */
function tbKeys(text, call, strict) {
  const consts = new Map();
  for (const m of text.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(["'`])([^"'`]*)\2/g)) {
    if (m[3].startsWith("tb-")) consts.set(m[1], m[3]);
  }
  const out = new Set();
  const re = new RegExp(`(?:${call})\\(\\s*("[^"]*"|'[^']*'|` + "`" + `[^` + "`" + `]*` + "`" + `|[A-Za-z_$][\\w$]*)`, "g");
  for (const m of text.matchAll(re)) {
    let arg = m[1].replace(/^["'`]|["'`]$/g, "");
    if (!arg.startsWith("tb-")) arg = consts.get(m[1]) ?? "";
    if (strict) {
      expect(arg.startsWith("tb-"), `有一个本地写入的目标键推不出来（${m[1]}）：§3 那段点名的清单要加它，判据也要能认它`).toBe(true);
    }
    if (!arg.startsWith("tb-")) continue;
    out.add(arg.replace(/\$\{[^}]*\}/g, "<chapter>"));
  }
  return out;
}

/** §1「数据源」列点名的存储键（`tb-review-reminder-*` 这类通配按前缀算）。 */
function s1Keys() {
  return [...new Set(
    METRICS.flatMap((r) => [...r.source.matchAll(/`(tb-[a-z0-9-]+)/g)].map((m) => m[1].replace(/-$/, ""))),
  )];
}

/** `hydrateFromCloud()` 往哪些本地键里写。 */
function mergeWriteKeys() {
  const body = fnBody("src/lib/sync-layer.ts", "hydrateFromCloud");
  expect(body, "src/lib/sync-layer.ts 里再也找不到 hydrateFromCloud 了，§3 那段与判据都要同步").toBeTruthy();
  return tbKeys(body, "writeLocalJson|localStorage\\.setItem", true);
}

/** src 下所有非测试源码（.ts/.tsx/.mjs），仓库相对路径。 */
function srcFiles() {
  return [...readdirSync(path.join(root, "src"), { recursive: true, withFileTypes: true })]
    .filter((e) => e.isFile() && /\.[cm]?tsx?$/.test(e.name) && !/\.(test|spec)\.[cm]?tsx?$/.test(e.name))
    .map((e) => path.relative(root, path.posix.join(e.parentPath ?? e.path, e.name)).split(path.sep).join("/"));
}

/** §1「数据源」那一格里点名、但**不是**存储键的东西：文件名与符号名。存储键由上一道门管。 */
function s1Refs() {
  const out = [];
  for (const r of METRICS) {
    const spans = [...r.source.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    out.push({ row: r.name, spans, refs: spans.filter((t) => !/^tb-/.test(t)) });
  }
  return out;
}

/** 一格里**裸写**（不在反引号里）的拉丁字母名。它既进不了 `s1Keys` 的 `` `tb-… `` 形状，
 *  也进不了符号名解析——上一轮的探针把「数据源列改指一个代码里没有的键」量成了红，量的却是
 *  「写成反引号的假键」那一半；「wrongbook SRS」这种不带键形的名字，整道门从来就看不见它。 */
function bareNames(cell) {
  const stripped = cell.replace(/`[^`]*`/g, " ").replace(/R\d+(?:\.\d+)?/g, " ");
  return [...stripped.matchAll(/[A-Za-z][A-Za-z0-9._ -]{2,}/g)].map((m) => m[0].trim());
}

/** 一个点名对不对得上代码：返回 null 算站得住，返回字符串是站不住的原因。
 *  `srcText` 得是全部非测试源码**去掉注释**之后拼起来的那一份——留着注释，一个代码里根本
 *  没有的名会被某句解释它的注释洗成「站得住」。 */
function resolveRef(token, files, srcText) {
  if (/\.[cm]?tsx?$/.test(token)) {
    const hits = files.filter((rel) => rel.split("/").pop() === token);
    if (hits.length === 1) return null;
    return hits.length
      ? `src 下有 ${hits.length} 个同名文件（${hits.join(" / ")}），光写文件名指不到唯一去处`
      : "src 下没有这个文件";
  }
  const sym = token.replace(/\(\)$/, "");
  if (!/^[A-Za-z_$][\w$]*$/.test(sym)) return "既不是文件名也不是符号名，判据认不出它指什么";
  const re = new RegExp(`(?:function|const|let|class)\\s+${sym.replace(/\$/g, "\\$")}\\b`);
  return re.test(srcText) ? null : `src 下找不到 ${sym} 的声明`;
}

/** 复习页顶部那一行是不是「一个 locale 三元、两个分支各自把到期数插进文案」。
 *  只认这个形状：两个分支必须相邻（`?` 紧跟 `:`），且都插 `${dueCount}`——
 *  少插一支就等于只有一种语言报数，那正是 §1 那一格原先的说法。 */
function dueBothLocales(text) {
  const lines = text.split("\n");
  return lines.some(
    (l, i) =>
      /^\s*\?\s*`[^`]*\$\{dueCount\}/.test(l) &&
      /^\s*:\s*`[^`]*\$\{dueCount\}/.test(lines[i + 1] ?? ""),
  );
}

const S3 = () => doc.slice(doc.indexOf("## 3."), doc.indexOf("\n## 4."));
/** §3 里以某个锚句定位那一段（结构变了当场红，不让它悄悄扫空）。 */
function paraOf(anchor) {
  const p = S3().split(/\n\n+/).find((x) => x.includes(anchor));
  expect(p, `§3 里找不到含「${anchor}」的那一段，这一节的结构变了要同步这里`).toBeTruthy();
  return p;
}

const CLIENT_SRC = read(CLIENT);
const LIB_MODULES = [...new Set([...CLIENT_SRC.matchAll(/from "@\/lib\/([\w.-]+)"/g)].map((m) => `src/lib/${m[1]}.ts`))];
/** 登录态与网络的信号：聚合器碰到任何一条，§3 那句「同一条代码算出来的」就垮了。 */
const AUTH_OR_NET = /useAuth|auth-provider|getSupabaseBrowser|createClient\(|\bfetch\s*\(|XMLHttpRequest|sendBeacon/;
/** 数据来源标识与同步时间卡用的那四个字典字段，以及那张卡读的那个值。 */
const SYNC_STATE_KEYS = ["sourceLocal", "sourceCloud", "sourceCloudPending", "sourceSyncedTpl"];
const zhDict = () => {
  const src = read(I18N);
  return src.slice(src.indexOf("const zh = {"), src.indexOf("const en: StatsDict"));
};

describe("§3 无登录对等：说出口的数都现读", () => {
  it("算指标的那批模块不认识登录，也不自己发请求", () => {
    expect(LIB_MODULES.length, "从 stats-client.tsx 推出来的 `src/lib` 模块少到不正常").toBeGreaterThanOrEqual(25);
    for (const rel of LIB_MODULES) {
      expect(existsSync(path.join(root, rel)), `统计页 import 了 ${rel}，文件却不在`).toBe(true);
      expect(
        AUTH_OR_NET.test(stripComments(read(rel))),
        `${rel} 碰到了登录态或网络，§3 那句「没有一处读登录态，也没有一处在自己发请求」不成立`,
      ).toBe(false);
    }
    // 正向对照：同一个信号必须认得出真正的消费点，否则上面那串零是空转出来的
    expect(AUTH_OR_NET.test(stripComments(CLIENT_SRC)), "这个信号连统计页自己的 useAuth() 都认不出来，判据废了").toBe(true);
  });

  it("§1 数据源点名的每个键都有经由 localStorage 的读写端", () => {
    const keys = s1Keys();
    expect(keys.length, "§1 的数据源列推不出几个键，扫描八成没跑起来").toBeGreaterThanOrEqual(4);
    const para = paraOf("数据源");
    for (const k of keys) expect(para, `§3 那一段没有点 ${k}，读者对不上 §1`).toContain(k);
    const named = new Set([...para.matchAll(/`(tb-[a-z0-9<>*-]+)`/g)].map((m) => m[1].replace(/-\*$/, "")));
    expect([...named].sort().join(" "), "§3 那段点名的键与 §1 数据源列不是一批").toBe([...keys].sort().join(" "));
    const stored = new Set(srcFiles().flatMap((rel) => [...tbKeys(stripComments(read(rel)), "localStorage\\.(?:get|set|remove)Item|readLocalJson|writeLocalJson|readStorageJson", false)]));
    expect(stored.size, "src 下推不出几个存储键，这道扫描八成没跑起来").toBeGreaterThanOrEqual(20);
    for (const k of keys) {
      // 通配键（`tb-review-reminder-*`）按前缀算：真键是 `-settings` 与 `-shown` 两个
      const hit = stored.has(k) || [...stored].some((s) => s.startsWith(`${k}-`));
      expect(hit, `${k} 在 src 下没有任何一处经由 localStorage 读写，§1 把它当数据源是错的`).toBe(true);
    }
  });

  it("§1 数据源格点名的每一样东西都在代码里，不留上一道门扫不到的名字", () => {
    const rowsOf = s1Refs();
    const files = srcFiles();
    const srcText = files.map((rel) => stripComments(read(rel))).join("\n");
    const refs = rowsOf.flatMap((r) => r.refs);
    expect(refs.length, "§1 的数据源格推不出几个非键点名，扫描八成没跑起来").toBeGreaterThanOrEqual(8);
    for (const r of rowsOf) {
      // 每一格至少得有一个反引号点名的东西：数据源整格写成散文，上一道门（只认 `` `tb-… ``）
      // 与这一道（只认反引号里的名）就都无从对账，「有读写端」那句话于是变成一句感觉。
      expect(r.spans.length, `「${r.row}」那一格没有一个反引号点名的东西，数据源说不出主人`).toBeGreaterThanOrEqual(1);
      for (const t of r.refs) {
        const why = resolveRef(t, files, srcText);
        expect(why, `「${r.row}」那一格点名的 \`${t}\` 站不住：${why}`).toBeNull();
      }
    }
    const bare = METRICS.flatMap((r) => bareNames(r.source).map((t) => `「${r.name}」格里的裸写名字「${t}」`));
    expect(bare, "§1 的数据源格里有裸写的名字：它不成存储键形、又不在反引号里，两道门都看不见它").toEqual([]);
    // 正向对照：两个探测器都必须认得坏形状，否则上面那串零是空转出来的
    expect(
      bareNames("wrongbook SRS + `tb-review-reminder-*`"),
      "裸名字探测器匹配不到「wrongbook SRS」这种写法，上面那个「[]」就是空转",
    ).toEqual(["wrongbook SRS"]);
    expect(resolveRef("noSuchOwnerAnywhere", files, srcText), "符号探测器连一个不存在的名都放行").toBeTruthy();
    expect(resolveRef("no-such-file-named-this.tsx", files, srcText), "文件探测器连一个不存在的文件都放行").toBeTruthy();
    // 反向对照：本轮改对的那一格，两个探测器都必须是干净的；真声明必须认得出
    expect(bareNames(metricOf("复习暴露率").source), "改好的那一格仍被当成有裸名字").toEqual([]);
    expect(resolveRef("readWrong", files, srcText), "符号探测器认不出 wrongbook.ts 里真有的 readWrong").toBeNull();
  });

  it("§3 那句「几个键」等于 §1 现读出来的键数", () => {
    const n = s1Keys().length;
    expect(n, "§1 推不出几个键，这条比对没有意义").toBeGreaterThanOrEqual(4);
    expect(
      new RegExp(`\\*\\*${n}\\*\\*\\s*个键`).test(paraOf("数据源")),
      `§3 那一句写的个数不是现读出来的 ${n}：§1 加一个键、或改一格，这句话就得跟着数`,
    ).toBe(true);
  });

  it("整页只有文中那个数的登录态消费点，且每一处都落在同步状态上", () => {
    const lines = CLIENT_SRC.split("\n");
    const decl = lines.findIndex((l) => /const user = useAuth\(\)/.test(l));
    expect(decl, `${CLIENT} 里不再以「const user = useAuth()」取登录态，判据要跟着改`).toBeGreaterThan(-1);
    const users = lines.filter((l, i) => i !== decl && /\buser\b/.test(l));
    expect(users.length, "消费登录态的地方少到不正常（扫描八成没跑起来）").toBeGreaterThanOrEqual(1);
    for (const l of users) {
      expect(
        SYNC_STATE_KEYS.some((k) => l.includes(`dict.${k}`)) || l.includes("lastCloudSync"),
        `统计页多了一处按登录态分支的东西，它不在同步状态那几句里：${l.trim()}——§3 那句「两处都不报指标」与本判据都要同步`,
      ).toBe(true);
    }
    const scoped = new Set();
    for (const [i, l] of lines.entries()) {
      if (i === decl || !/\buser\b/.test(l)) continue;
      for (const k of SYNC_STATE_KEYS) if (lines.slice(i, i + 6).some((x) => x.includes(`dict.${k}`))) scoped.add(k);
    }
    for (const k of SYNC_STATE_KEYS) {
      const seen = lines.filter((l) => l.includes(`dict.${k}`));
      expect(seen.length, `dict.${k} 在统计页出现的次数不是 1，那句「只有这两处」要重看`).toBe(1);
      expect(scoped.has(k), `dict.${k} 现在挂在了一处不消费登录态的地方，§3 那段与判据都要同步`).toBe(true);
    }
    const para = paraOf("与账号有关的东西");
    expect(para, `§3 那句处数不是 ${users.length}`).toContain(`**${users.length}** 处`);
    for (const k of SYNC_STATE_KEYS) {
      const value = new RegExp(`${k}: "([^"]+)"`).exec(zhDict())?.[1];
      expect(value, `${I18N} 的 zh 字典里读不到 ${k}`).toBeTruthy();
      expect([...para.matchAll(/「([^」]+)」/g)].map((m) => m[1]), `§3 引的那几句标签与字典对不上（${k} = ${value}）`).toContain(value);
    }
  });

  it("登录写回的那串键，与 hydrateFromCloud 的写入端逐个对上", () => {
    const keys = mergeWriteKeys();
    expect(keys.size, "从 hydrateFromCloud 推不出几个写入键，判据空转").toBeGreaterThanOrEqual(5);
    const para = paraOf("hydrateFromCloud");
    for (const k of keys) expect(para, `§3 那段漏了 ${k}（云端合并会写它）`).toContain(k);
    const named = new Set([...para.matchAll(/`(tb-[a-z0-9<>*-]+)`/g)].map((m) => m[1].replace(/-\*$/, "")));
    expect(named.size, `§3 那段点名的键数与推导值（${keys.size}）不一致：${[...named].join("、")}`).toBe(keys.size);
    for (const k of named) expect(keys.has(k), `§3 那段点了 ${k}，可 hydrateFromCloud 并不写它`).toBe(true);
    expect(para, `§3 那句个数不是 ${keys.size}`).toContain(`**${keys.size}** 个键`);
    // 云端与本地口径的接头处：至少一个写回键同时是 §1 的数据源，文中那句「其中…」说的就是它
    const overlap = s1Keys().filter((k) => keys.has(k));
    expect(overlap.length, "云端合并再也不碰 §1 任何一个数据源了，那段的推论要重看").toBeGreaterThanOrEqual(1);
    for (const k of overlap) expect(para, `§3 没交代 ${k} 既是云端写回键又是 §1 数据源`).toContain(k);
  });
});

/** §4 那份「了以后复查」清单：每一行都要指着一件仓库里查得到的东西。 */
describe("§4 清单每行都点名了它的锁", () => {
  const checklist = () => doc.slice(doc.indexOf("## 4.")).split("\n").filter((l) => /^- \[[ x]\]/.test(l));

  it("勾掉的每一行都点了一个真实文件", () => {
    const rows = checklist().filter((l) => l.startsWith("- [x]"));
    expect(rows.length, "§4 勾掉的行少到不正常").toBeGreaterThanOrEqual(4);
    for (const l of rows) {
      const files = [...l.matchAll(/`((?:src|scripts|docs)\/[^`\s]+)`/g)].map((m) => m[1]);
      expect(files.length, `这一行没有点名任何文件，「由…锁定」就只是一句承诺：${l}`).toBeGreaterThanOrEqual(1);
      for (const f of files) expect(existsSync(path.join(root, f)), `§4 指着 ${f}，仓库里没有`).toBe(true);
    }
  });

  it("「90 天 / 100 轮」那两个数就是 §2 表里的同两个数", () => {
    const row = checklist().find((l) => /修剪策略与隐私页/.test(l));
    expect(row, "§4 不再有「修剪策略与隐私页」那一行").toBeTruthy();
    const m = /（(\d+) 天 \/ (\d+) 轮/.exec(row);
    expect(m, `那一行不再用「（N 天 / M 轮」这个形状写窗口`).toBeTruthy();
    const days = table.find((r) => r.key === "tb-study-time");
    const rounds = table.find((r) => r.key === "tb-replay-history");
    expect(days && rounds, "§2 表里读不到学习台账与回放两行，这个对账无从做起").toBeTruthy();
    expect(m[1], `§4 写的天数与 §2 那一行（${days.numbers.join("、")}）不是一回事`).toBe(days.numbers[0]);
    expect(m[2], `§4 写的轮数与 §2 那一行（${rounds.numbers.join("、")}）不是一回事`).toBe(rounds.numbers[0]);
  });

  it("§4 指着的那份游客契约测试，真的在没有 AuthProvider 的情况下渲染统计页", () => {
    const row = checklist().find((l) => /无登录降级/.test(l));
    expect(row, "§4 不再有「无登录降级」那一行").toBeTruthy();
    const file = /`((?:src|scripts)\/[^`\s]+\.test\.tsx?)`/.exec(row)?.[1];
    expect(file, `那一行没有点名测试文件：${row}`).toBeTruthy();
    const src = read(file);
    expect(src.includes("render(<StatsClient"), `${file} 不再直接渲染统计页，它锁不住「无登录降级」`).toBe(true);
    expect(/<AuthProvider/.test(src), `${file} 现在套了 AuthProvider，它验的已经不是无登录路径`).toBe(false);
  });
});
