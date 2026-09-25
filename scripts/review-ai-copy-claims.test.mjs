/**
 * R16.272：`docs/roadmap.md` 的 R16.108 那行对复习页 `AiQuiz` 文案的说法，逐句回代码核。
 *
 * 那行登记时写着「其中每一条在 `i18n.ts` 的 `ai.*` 里都有对应的键」，本轮去数才发现不成立：
 * 按值扫，`ai.*` 里只有 5 条找得到同一句。所以这里的每条判据都**从代码推导**，
 * 不把文档里的数字换个新值抄一遍——抄回来的数字下次一样会漂。
 *
 * 只管现在式那几句。行里「登记时是 16 条，分布 6 / 3 / 1 / 6」是历史记录，
 * 历史那一份要的是「当时量出来的」，工作树里没有它，故不归这里判（台账第二身份的规矩，
 * 见 docs/progress.md 里 R16.272 那条的「已知边界」）。
 *
 * 运行：`npx vitest run scripts/review-ai-copy-claims.test.mjs`（跟随 `npm test`）
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const REVIEW = "src/components/review-client.tsx";
const AI_QUIZ = "src/components/ai-quiz.tsx";
const I18N = "src/lib/i18n.ts";
const LESSON_PAGE = "src/app/[locale]/knowledge/[chapter]/[doc]/page.tsx";
const ROADMAP = "docs/roadmap.md";

/** 取 `dict={{ … }}` 里那些 `x: locale === "en" ? "…" : "…"` 的装配项。 */
function assembled(source) {
  const lines = source.split("\n");
  const start = lines.findIndex((l) => /^\s+dict=\{\{$/.test(l));
  expect(start, `${REVIEW} 里找不到 \`dict={{\` 那个装配块，推导已经失效`).toBeGreaterThanOrEqual(0);
  const rows = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*\}\}$/.test(lines[i])) break;
    const m = /^\s+(\w+):\s*locale === "en" \? "((?:[^"\\]|\\.)*)" : "((?:[^"\\]|\\.)*)",\s*$/.exec(
      lines[i]
    );
    if (m) rows.push({ field: m[1], en: m[2].replace(/\\"/g, '"'), zh: m[3] });
  }
  return rows;
}

/** 组件自己声明的字典字段：props 接口里内联的 `dict: { … }`，一行可以好几个。 */
function declared(source) {
  const lines = source.split("\n");
  const start = lines.findIndex((l) => /^\s+dict\s*:\s*\{\s*$/.test(l));
  expect(start, `${AI_QUIZ} 里找不到内联的 \`dict: {\` 声明`).toBeGreaterThanOrEqual(0);
  const fields = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s+\};\s*$/.test(lines[i])) break;
    const line = lines[i].replace(/\s*\/\/[^/]*$/, "").trim();
    if (!line || line.startsWith("/*") || line.startsWith("*") || line.endsWith("*/")) continue;
    for (const part of line.split(";")) {
      const m = /^(\w+)\??\s*:\s*(?:string|string\[\])\s*$/.exec(part.trim());
      if (m) fields.push(m[1]);
    }
  }
  return fields;
}

/** 某一语言块里「取值 → 键名」的倒排（逐字相等；嵌套组用 `组.键` 记）。 */
function valueIndex(source, name) {
  const head = new RegExp(`^const ${name}(?::[^=]+)? = \\{`, "m").exec(source);
  expect(head, `找不到 const ${name} = {`).toBeTruthy();
  let depth = 1;
  let i = head.index + head[0].length;
  for (; i < source.length && depth > 0; i++) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") depth -= 1;
  }
  const index = new Map();
  let group = "";
  for (const line of source.slice(head.index, i).split("\n")) {
    const g = /^  (\w+): \{$/.exec(line);
    if (g) { group = g[1]; continue; }
    if (/^\s{2}\}/.test(line)) { group = ""; continue; }
    const m = /^\s+(\w+):\s*"((?:[^"\\]|\\.)*)"\s*,?\s*(?:\/\/.*)?$/.exec(line);
    if (!m) continue;
    const value = m[2].replace(/\\"/g, '"');
    if (!index.has(value)) index.set(value, []);
    index.get(value).push(group ? `${group}.${m[1]}` : m[1]);
  }
  return index;
}

/** 某一条装配文案落在四格里的那一格。 */
function bucketOf(entry, zh, en) {
  const inZh = zh.get(entry.zh) ?? [];
  const inEn = en.get(entry.en) ?? [];
  if (inZh.length && inEn.length) return "both";
  if (inZh.length) return "zhOnly";
  if (inEn.length) return "enOnly";
  return "neither";
}

/** 台账里 R16.108 那一整行。 */
function row108() {
  const row = read(ROADMAP)
    .split("\n")
    .find((line) => line.startsWith("- [ ] R16.108 "));
  expect(row, "roadmap 里找不到 R16.108 那一行（它被移走或改了前缀，这几条判据就没主人了）").toBeTruthy();
  return row;
}

describe("R16.108 那行对 AiQuiz 文案副本的说法", () => {
  const review = read(REVIEW);
  const aiQuiz = read(AI_QUIZ);
  const i18n = read(I18N);
  const entries = assembled(review);
  const fields = declared(aiQuiz);
  const zh = valueIndex(i18n, "zh");
  const en = valueIndex(i18n, "en");
  const buckets = { both: [], zhOnly: [], enOnly: [], neither: [] };
  for (const entry of entries) buckets[bucketOf(entry, zh, en)].push(entry);

  it("推导本身没缩水（装配项、接口字段、字典两侧都在）", () => {
    expect(entries.length, "装配块里推不出 14 条，推导在缩水").toBeGreaterThanOrEqual(14);
    expect(fields.length, "组件接口推不出 14 个字段").toBeGreaterThanOrEqual(14);
    expect(zh.size, "中文侧只解析出这么点取值，扫描瞎了").toBeGreaterThanOrEqual(300);
    expect(en.size, "英文侧只解析出这么点取值，扫描瞎了").toBeGreaterThanOrEqual(300);
  });

  it("页面装配的那套键，与组件声明的那套字段，逐个对上", () => {
    expect(
      entries.map((e) => e.field).filter((f) => !fields.includes(f)),
      "装配了组件从不声明的键"
    ).toEqual([]);
    expect(
      fields.filter((f) => !entries.some((e) => e.field === f)),
      "组件声明了页面没装配的键"
    ).toEqual([]);
  });

  it("行里那句「装配了却从不读」现在必须是零：声明的每个字段都真挂在 dict 上被读", () => {
    const lines = aiQuiz.split("\n");
    const at = lines.findIndex((l) => /^\s+dict\s*:\s*\{\s*$/.test(l));
    const closing = lines.findIndex((l, i) => i > at && /^\s+\};\s*$/.test(l));
    const body = lines.filter((_, i) => i < at || i > closing).join("\n");
    const unread = (fields, text) =>
      fields.filter(
        (f) =>
          !new RegExp(`\\bdict\\s*\\.\\s*\\??\\s*${f}\\b`).test(text) &&
          !new RegExp(`\\{[^{}]*\\b${f}\\b[^{}]*\\}\\s*=\\s*dict\\b`).test(text)
      );
    expect(unread(fields, body), "`AiQuiz` 又有了装配了却不读的字段").toEqual([]);
    // 正向对照：把一处读法换成 `q.badge`（本轮那个失配的形状），这条就必须点出它
    const dead = body.replace("dict.badge", "q.badge");
    expect(dead, "对照没换成功：组件里已经没有 `dict.badge` 了？").not.toBe(body);
    expect(unread(fields, dead), "字段被数据对象读走时这条抓不住，那就等于没判据").toEqual(["badge"]);
  });

  it("行里那句「`ai.*` 里能按值找到同一句的只有 5 条」由字典说了算", () => {
    const inAiGroup = entries.filter((entry) => {
      const at = zh.get(entry.zh) ?? [];
      return at.some((key) => key.startsWith("ai."));
    });
    const claimed = Number(/`ai\.\*` 里能按值找到同一句的只有 (\d+) 条/.exec(row108())?.[1]);
    expect(Number.isFinite(claimed), "那一行不再报这个数，谁去数？").toBe(true);
    expect(claimed, `那一行说 ${claimed} 条，字典里按值能找到的是 ${inAiGroup.length} 条`).toBe(
      inAiGroup.length
    );
    expect(inAiGroup.length, "这一轮的判据不该恒真：少于两条就说明字典或装配块变了").toBeGreaterThanOrEqual(2);
  });

  it("现在那 14 条的四格分布与行里写的 6 / 3 / 1 / 4 是同一份测量", () => {
    const claimed = /删到 14 条之后是 (\d) \/ (\d) \/ (\d) \/ (\d)/.exec(row108());
    expect(claimed, "行里那句四格分布换了写法，这几条判据就没主人了").toBeTruthy();
    expect(
      [buckets.both.length, buckets.zhOnly.length, buckets.enOnly.length, buckets.neither.length],
      `实量 ${buckets.both.length}/${buckets.zhOnly.length}/${buckets.enOnly.length}/${buckets.neither.length}，行里写 ${claimed.slice(1).join("/")}`
    ).toEqual(claimed.slice(1).map(Number));
    expect(entries.length).toBe(
      buckets.both.length + buckets.zhOnly.length + buckets.enOnly.length + buckets.neither.length
    );
  });

  it("行里点名的每一道 `check:*` 门禁都得真的存在，或是被明说成历史误写", () => {
    const scripts = Object.keys(JSON.parse(read("package.json")).scripts);
    const row = row108();
    // 逐个点名判，不按整句豁免：本轮那句误写（`check:placeholder`）与它旁边的
    // `check:localized-labels` 在同一段里，按句豁免会把真声称存在的名字一起放走。
    // 豁免只认贴着名字的否证措辞：前面 60 字里的「这里写的是」，或后面 40 字里的「反例」。
    const live = [];
    const ghosts = [];
    let retracted = 0;
    for (const match of row.matchAll(/check:[a-z0-9-]+/g)) {
      const before = row.slice(Math.max(0, match.index - 60), match.index);
      const after = row.slice(match.index + match[0].length, match.index + match[0].length + 40);
      if (/这里写的是|登记时写的是/.test(before) || /反例/.test(after)) {
        retracted += 1;
        continue;
      }
      live.push(match[0]);
      if (!scripts.includes(match[0])) ghosts.push(`${match[0]} ← ${before.slice(-24)}⟨${match[0]}⟩`);
    }
    expect(ghosts, `那一行点名了不存在的门禁（幽灵门禁）：\n${ghosts.join("\n")}`).toEqual([]);
    expect(live.length, "那一行没有以现行身份点名任何门禁，这条判据是空转").toBeGreaterThanOrEqual(2);
    expect(
      retracted,
      "本行没留下那句误写的说明：要么它已被改掉（这条该跟着收紧），要么否证措辞换了写法"
    ).toBeGreaterThanOrEqual(1);
  });

  it("课文页那一站装的是另一个组件，字段集也与 `AiQuiz` 不同", () => {
    const page = read(LESSON_PAGE);
    expect(page, "课文页不再挂 AiChapterQuizCard，这一句该改口了").toMatch(/<AiChapterQuizCard/);
    expect(page, "课文页直接挂 AiQuiz 的话，「两张表」的说法就假了").not.toMatch(/<AiQuiz\b/);
    const chapterFields = (() => {
      const src = read("src/components/ai-chapter-quiz.tsx");
      const lines = src.split("\n");
      const start = lines.findIndex((l) => /^interface AiChapterQuizDict \{$/.test(l));
      expect(start, "篇章页那个组件的字典接口改了名字").toBeGreaterThanOrEqual(0);
      const out = [];
      for (let i = start + 1; i < lines.length; i++) {
        if (/^\}/.test(lines[i])) break;
        const m = /^\s+(\w+)\??\s*:\s*string(?:\[\])?\s*;$/.exec(lines[i]);
        if (m) out.push(m[1]);
      }
      return out;
    })();
    expect(chapterFields.length, "篇章页那张表推不出字段，比对是空转").toBeGreaterThanOrEqual(10);
    const onlyQuiz = fields.filter((f) => !chapterFields.includes(f));
    const onlyChapter = chapterFields.filter((f) => !fields.includes(f));
    expect(onlyQuiz.length, "两张表的字段集已经一样了，那行得改口").toBeGreaterThan(0);
    expect(onlyChapter.length, "同上").toBeGreaterThan(0);
  });
});
