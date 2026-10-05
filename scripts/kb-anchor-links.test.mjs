/**
 * R16.114：课文里的每一个 `](#…)` 锚点，在本站渲染器下必须真的点到目标标题。
 *
 * **这道门禁的由来**：R16.114 登记了两条点不动的锚点（zh/en 各一条
 * `precious-metals-energy.md` 里的 `⑤` 段），成因是**两个渲染器的 slug 规则不同**：
 * 知识库 `kb-anchor-check.mjs` 的 `slugify()` 末尾剥掉首尾连字符，而本站的
 * `rehype-slug`（GitHub 规则）不剥。内容侧的 `kb-anchor-check` 是绿的（它按自己那套
 * 规则自洽），本站当时**没有任何一道门**跨渲染器核对过 —— 于是这条从上游漏到了线上。
 *
 * **为什么必须是「跨渲染器」**：两边各自都对（各自按自己的规则判），合起来却错。
 * 只在任一侧加断言都抓不到，所以本门禁把「知识库规则」和「本站实际渲染结果」放在一起比。
 *
 * 用真实管线（remark-parse → remark-rehype → rehype-slug → rehypeSlugAlign）跑，
 * 而不是抄一份 slugify —— 抄的那份下次有人改了插件就会悄悄过期，这正是本条要避免的。
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import { rehypeSlugAlign } from "../src/lib/rehype-slug-align";
import GithubSlugger from "github-slugger";
import { extractHeadings } from "../src/lib/toc";

const ROOT = "content/kline-buty/docs/knowledge";

/**
 * 下面两条要跑全库 419 个文件、每个文件一份全新渲染管线，实测本地 ~3s。
 * vitest 默认单条 5s，而 `test:coverage`（CI 跑的那条）开了 v8 插桩后会到 ~9s ——
 * 于是本地全绿、CI 超时红。**门禁自己超时等于没有门禁**，所以显式给足预算。
 */
const CORPUS_TIMEOUT = 120_000;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

/**
 * 每个文件一份全新管线。
 *
 * **踩过的坑**：第一版把一个 `unified` processor 复用到全库 419 个文件上，
 * 单跑绿、全量跑偶发红 —— 因为 slugger 的去重计数（重复标题追加 `-1`/`-2`）
 * 会跨文件累积，于是「渲染出来的 id」与 `extractHeadings`（每文件新建 slugger）
 * 在某些文件上分叉。判据自身不确定，等于没有判据。
 */
function makeProcessor() {
  return unified().use(remarkParse).use(remarkRehype).use(rehypeSlug).use(rehypeSlugAlign);
}

function headingIds(body, processor) {
  return processor
    .run(processor.parse(body))
    .then((tree) => {
      const ids = [];
      const visit = (n) => {
        if (n.tagName && /^h[1-6]$/.test(n.tagName) && typeof n.properties?.id === "string") {
          ids.push(n.properties.id);
        }
        for (const c of n.children ?? []) visit(c);
      };
      for (const child of tree.children ?? []) visit(child);
      return ids;
    })
    .catch(() => ids_fallback());
}
// 解析失败时宁可让断言红，也不要静默放行
function ids_fallback() {
  throw new Error("渲染管线跑不通，这条门禁失去判据");
}

describe("R16.114 / R16.301：锚点与目录在本站渲染器下真的点得到", () => {
  it("知识库目录在树内（否则下面全是空转）", () => {
    expect(readdirSync(ROOT).sort()).toContain("zh");
    expect(readdirSync(ROOT).sort()).toContain("en");
  });

  it("每个 (#…) 锚点都能命中本页某个标题", async () => {
    const broken = [];
    let checked = 0;
    for (const file of walk(ROOT)) {
      const raw = readFileSync(file, "utf8");
      const body = raw.replace(/^---\n[\s\S]*?\n---\n/, "");
      const targets = [...body.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]);
      if (targets.length === 0) continue;
      const ids = await headingIds(body, makeProcessor());
      for (const t of targets) {
        checked += 1;
        if (!ids.includes(t)) broken.push(`${file.replace(`${ROOT}/`, "")} → #${t}`);
      }
    }
    // 判据不许空转：全库至少要有若干条锚点链接
    expect(checked, "一条锚点链接都没扫到，这条门禁是空转").toBeGreaterThanOrEqual(4);
    expect(broken, `这些锚点在本站点不动：\n${broken.join("\n")}`).toEqual([]);
  }, CORPUS_TIMEOUT);

  it("正向对照：去掉 slug 对齐那一步，R16.114 那两条必须重新变红", async () => {
    // 只挂 rehype-slug、不挂 rehypeSlugAlign —— 即修复前的渲染行为
    const unaligned = unified().use(remarkParse).use(remarkRehype).use(rehypeSlug);
    const file = join(ROOT, "zh/markets-instruments/precious-metals-energy.md");
    const body = readFileSync(file, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "");
    const anchor = [...body.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]).find((t) => t.includes("金银比"));
    expect(anchor, "这一行没找到 R16.114 那条锚点，样例可能挪了位置").toBeTruthy();
    const ids = await headingIds(body, unaligned);
    expect(ids, "对照失效：未对齐时 id 里不该有前导连字符").toContain(`-${anchor}`);
    const aligned = await headingIds(body, makeProcessor());
    expect(aligned, "对齐后应当命中").toContain(String(anchor));
  });

  // ↓↓↓ R16.301 ↓↓↓
  // 第一版只有上面那条，于是漏了「本页目录」。上线后一查生产才发现：目录里的 href 带前导
  // 连字符、而渲染出来的 id 不带 —— 也就是说**目录比正文坏得更明显**（目录是主要入口），
  // 而门禁是绿的。原因很直白：目录 href 不来自课文，它由 `extractHeadings()` 用
  // github-slugger **自己**再 slug 一次，是**第三份** slug 实现，压根没经过上面那条断言。
  it("目录里每个条目都能命中本页真实标题（目录 href 来自第三份 slug 实现）", async () => {
    const broken = [];
    let checked = 0;
    for (const file of walk(ROOT)) {
      const body = readFileSync(file, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "");
      const tocIds = extractHeadings(body).map((h) => h.id);
      if (tocIds.length === 0) continue;
      const ids = await headingIds(body, makeProcessor());
      for (const id of tocIds) {
        checked += 1;
        if (!ids.includes(id)) broken.push(`${file.replace(`${ROOT}/`, "")} → #${id}`);
      }
    }
    expect(checked, "一个目录条目都没扫到，这条门禁是空转").toBeGreaterThanOrEqual(100);
    expect(broken, `这些目录条目在本站点不动：\n${broken.slice(0, 20).join("\n")}`).toEqual([]);
  }, CORPUS_TIMEOUT);

  it("正向对照：目录若各 slug 一次而不共享口径，R16.301 立刻现形", async () => {
    const file = join(ROOT, "zh/markets-instruments/precious-metals-energy.md");
    const body = readFileSync(file, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "");
    const rendered = await headingIds(body, makeProcessor());

    // 「目录自己 slug 一次、不共享 alignHeadingId」= 第一版的漏法
    const naive = new GithubSlugger();
    const naiveIds = extractHeadings(body).map((h) => h.text).map((t) => naive.slug(t));

    expect(
      naiveIds.filter((id) => !rendered.includes(id)),
      "对照失效：naive 目录 id 竟然全都命中了，这条对照已无判据"
    ).not.toEqual([]);

    // 共享口径之后，目录条目必须逐条命中
    expect(extractHeadings(body).map((h) => h.id).filter((id) => !rendered.includes(id))).toEqual([]);
  });
});