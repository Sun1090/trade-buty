/**
 * R16.247：`docs/growth-events.md` 的事件目录必须就是 `src/lib/growth-events.ts`。
 *
 * 那份文档是增长事件的唯一目录：新增事件的人照它抄字段，审隐私的人照它读「允许哪些取值」，
 * 而 `scripts/growth-event-privacy.mjs` 只核对事件名**出现过**没有——表格形状、每个事件的
 * 字段清单、每个字段的取值集合过去没有任何东西对着。文档自己还写着「门禁会逐个回字典比对」，
 * 那句当时是空的。这里把它变成真的：文档是抄件，代码是原件。
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const doc = read("docs/growth-events.md");
const eventsSrc = read("src/lib/growth-events.ts");
const privacySrc = read("scripts/growth-event-privacy.mjs");

const flat = (s) => s.replace(/\s+/g, "");
const quoted = (s) => [...s.matchAll(/["']([a-z0-9_-]+)["']/g)].map((m) => m[1]);
/** 文档单元格里的反引号词（表格用 `x` 而不是引号写取值）。 */
const ticked = (s) => [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
/** 去掉 markdown 加粗，免得判据被 `**` 劈开。 */
const noBold = (s) => s.replace(/\*\*/g, "");

/** 文档「事件目录」表的行：{ name, fields, restriction } */
function tableRows() {
  const body = doc.slice(doc.indexOf("## 1. 事件目录"), doc.indexOf("### 枚举"));
  return body
    .split("\n")
    .filter((l) => /^\| `/.test(l))
    .map((l) => {
      const cells = l.split(/(?<!\\)\|/);
      const cell = cells[3] ?? "";
      const restriction = [...cell.matchAll(/（[^）]*）/g)].flatMap((m) => ticked(m[0]));
      return {
        name: (cells[1] ?? "").replace(/`/g, "").trim(),
        fields: ticked(cell.replace(/（[^）]*）/g, "")),
        restriction,
      };
    });
}

/** 类型别名与运行时白名单：两边都是取值的来源。 */
const aliases = new Map();
for (const m of eventsSrc.matchAll(/export type ([A-Za-z]\w*)\s*=\s*([^;]+);/g)) {
  if (m[2].includes("|") || /^"[^"]+"$/.test(m[2].trim())) aliases.set(m[1], quoted(m[2]));
}
for (const m of eventsSrc.matchAll(/new Set<([A-Za-z]\w*)>\(\[([^\]]*)\]\)/g)) {
  const vals = quoted(m[2]);
  const prev = aliases.get(m[1]) ?? [];
  aliases.set(m[1], [...new Set([...prev, ...vals])]);
}

/** 判别联合：{ 事件名 -> { 字段 -> { type, allowed } } } */
function variants() {
  const start = eventsSrc.indexOf("export type GrowthEvent =");
  const block = eventsSrc.slice(start, eventsSrc.indexOf("\nconst ", start));
  const out = new Map();
  for (const m of block.matchAll(/\{\s*name:\s*([^;]+);([\s\S]*?)\n\s*\}/g)) {
    const names = quoted(m[1]);
    const fields = new Map();
    for (const f of m[2].matchAll(/^\s*(\w+)\s*:\s*([^;]+);/gm)) {
      const raw = f[2].trim();
      const ext = /^Extract<([A-Za-z]\w*),\s*(.+)>$/.exec(raw);
      fields.set(f[1], ext
        ? { type: ext[1], allowed: quoted(ext[2]), restricted: true }
        : { type: raw, restricted: false, allowed: raw.includes("|") || raw.startsWith('"') ? quoted(raw) : (aliases.get(raw) ?? []) });
    }
    for (const n of names) out.set(n, fields);
  }
  return out;
}

const rows = tableRows();
const byName = variants();

describe("事件目录的每一行都等于判别联合里的那一支", () => {
  it("行集合与事件名清单同名同序", () => {
    const list = /GROWTH_EVENT_NAMES\s*=\s*\[([\s\S]*?)\]/.exec(eventsSrc)?.[1] ?? "";
    const declared = quoted(list);
    expect(declared.length, "没读到 GROWTH_EVENT_NAMES").toBeGreaterThanOrEqual(9);
    expect(rows.map((r) => r.name), "文档的事件行与代码的事件名不一致（含顺序）").toEqual(declared);
  });

  for (const row of rows) {
    it(`${row.name} 的字段清单与取值限制成立`, () => {
      const fields = byName.get(row.name);
      expect(fields, `代码里没有 ${row.name} 这一支判别联合`).toBeTruthy();
      expect([...(fields?.keys() ?? [])].filter((k) => k !== "name").sort(),
        `${row.name} 的字段清单与代码不符`).toEqual([...row.fields].sort());
      const restricted = [...fields.values()].filter((f) => f.restricted);
      expect(row.restriction.sort(), `${row.name} 的「只允许」与代码里的 Extract 不符`)
        .toEqual(restricted.flatMap((f) => f.allowed).sort());
    });
  }
});

describe("枚举那一节是取值的唯一一份说明", () => {
  const body = doc.slice(doc.indexOf("### 枚举"), doc.indexOf("## 2."));
  const lines = body.split("\n").filter((l) => /^- `/.test(l));

  it("字段全集不多不少", () => {
    const used = new Set();
    for (const fields of byName.values()) for (const k of fields.keys()) if (k !== "name") used.add(k);
    const listed = lines.map((l) => /`([a-z]+)`/.exec(l)?.[1]).filter(Boolean);
    expect(listed.length, "枚举那一节没解析出任何一行").toBeGreaterThanOrEqual(used.size);
    expect(new Set(listed), `枚举小节的字段与事件里用到的不是一套（代码是 ${[...used].join("、")}）`)
      .toEqual(used);
    expect(flat(body), `引言那句「上面 ${rows.length} 行事件一共用到 ${used.size} 个字段」与产物不符`)
      .toContain(`上面${rows.length}行事件一共用到${used.size}个字段`);
  });

  for (const line of lines) {
    const key = /`([a-z]+)`/.exec(line)?.[1];
    it(`${key} 的取值逐个都是代码里的那些`, () => {
      const after = line.slice(line.indexOf("：") + 1).replace(/（[^）]*）/g, "");
      const values = quoted(`"${after.replace(/\|/g, '","').replace(/["`]/g, '"')}"`)
        .filter((v) => /^[a-z][a-z0-9_-]*$/.test(v));
      const allowed = new Set();
      for (const fields of byName.values()) {
        const f = fields.get(key);
        if (f) for (const v of f.allowed) allowed.add(v);
      }
      expect(allowed.size, `${key} 在代码里一个取值都没解析出来`).toBeGreaterThan(0);
      for (const v of values) {
        expect(allowed.has(v), `文档给 ${key} 列的取值「${v}」不在代码里（代码是 ${[...allowed].join(" | ")}）`).toBe(true);
      }
      expect([...values].sort(), `代码里 ${key} 的取值有没被文档列出的（代码是 ${[...allowed].sort().join(" | ")}）`)
        .toEqual([...allowed].sort());
    });
  }
});

describe("文档说的出口、分享卡数量与门禁能力都对得上", () => {
  it("出口确实只有一处，参数就是文档写的那三个", () => {
    const calls = eventsSrc.match(/console\s*\.\s*info\s*\(/g) ?? [];
    expect(calls.length, "出口不止一个 console.info，§0 那句「只有」已经不成立").toBe(1);
    expect(eventsSrc).toMatch(/console\.info\(\s*"\[growth-event\]"\s*,\s*safe\.name\s*,\s*safe\s*\)/);
    expect(flat(doc), "文档 §0 没有把这三个参数写出来").toContain('console.info("[growth-event]",name,payload)');
  });

  it("「三张分享卡」就是仓库里的分享卡组件数，且五处触发路径都有用例", () => {
    const cards = readdirSync(path.join(root, "src/components"))
      .filter((n) => n.endsWith("-share-card.tsx") && !n.endsWith(".test.tsx"));
    expect(cards.length).toBeGreaterThanOrEqual(3);
    expect(flat(noBold(doc)), `文档说「${cards.length} 张分享卡」，卡片数变了要同步这句话`)
      .toContain(flat(`覆盖 ${cards.length} 张分享卡`));
    const tests = ["quiz-share-card", "replay-share-card", "streak-share-card", "share-landing-ctas", "invite-banner"];
    for (const t of tests) {
      const rel = `src/components/${t}.test.tsx`;
      expect(existsSync(path.join(root, rel)), `${rel} 不存在`).toBe(true);
      expect(read(rel), `${rel} 没有触碰增长事件，「真实触发路径」这句对它不成立`).toMatch(/growthEvent|trackGrowthEvent/);
    }
  });

  it("隐私门禁禁的出口类别与文档写的数目一致", () => {
    const block = privacySrc.slice(privacySrc.indexOf("FORBIDDEN_SINKS"), privacySrc.indexOf("];", privacySrc.indexOf("FORBIDDEN_SINKS")));
    const kinds = [...block.matchAll(/\[\s*"([^"]+)",\s*\/([^/]+)\//g)].map((m) => ({ label: m[1], re: new RegExp(m[2]) }));
    expect(kinds.length, "没读到 FORBIDDEN_SINKS").toBeGreaterThanOrEqual(6);
    expect(noBold(doc), `文档写的禁区类数不是 ${kinds.length}`).toContain(`${kinds.length} 类出口`);
    expect(noBold(read("docs/growth-event-privacy-audit.md")), `审计文档写的禁区类数不是 ${kinds.length}`)
      .toContain(`${kinds.length} 类出口`);
    /** 每条禁区都得真拦得住一个形状：新增一条禁区，就要在这里给它一个夹具（别删判据）。 */
    const SINK_FIXTURES = {
      "network fetch": "fetch('/collect')",
      "network sendBeacon": "navigator.sendBeacon('/collect')",
      "network XMLHttpRequest": "new XMLHttpRequest()",
      "persistent storage": "window.localStorage.setItem('a', '1')",
      "cookie write/read": "document.cookie = 'a=1'",
      "clipboard access": "navigator.clipboard.writeText('x')",
    };
    for (const k of kinds) {
      const fixture = SINK_FIXTURES[k.label];
      expect(fixture, `禁区里多了一条「${k.label}」，判据还不知道它长什么样`).toBeTruthy();
      expect(k.re.test(fixture), `禁区条目「${k.label}」连自己的夹具都不匹配，那条正则已经形同虚设`).toBe(true);
    }
    expect(Object.keys(SINK_FIXTURES).sort(), "文档与门禁的禁区条数对不上")
      .toEqual(kinds.map((k) => k.label).sort());
  });
});

describe("这份文档自己的引用查得到", () => {
  it("点名的路径与 roadmap 编号都还在", () => {
    const paths = [...new Set([...doc.matchAll(/`((?:src|scripts|docs)\/[^`\s]+)`/g)].map((m) => m[1]))];
    expect(paths.length, "文档一个路径都没提到").toBeGreaterThanOrEqual(4);
    for (const p of paths) expect(existsSync(path.join(root, p)), `文档指着 ${p}，仓库里没有`).toBe(true);
    const roadmap = read("docs/roadmap.md");
    const ids = [...new Set([...doc.matchAll(/\bR\d+\.\d+\b/g)].map((m) => m[0]))];
    expect(ids.length, "文档不再引用任何台账号").toBeGreaterThanOrEqual(3);
    for (const id of ids) expect(roadmap, `${id} 在 roadmap 里查无此项`).toContain(id);
  });
});
