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
