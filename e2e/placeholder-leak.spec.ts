import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { getDict, LOCALES } from "../src/lib/i18n";
import { getStatsDict } from "../src/lib/i18n-stats";
import { localDateStr, shiftDate } from "../src/lib/date-utils";
import { weekMinutes } from "../src/lib/weekly-summary";

/**
 * R16.24：词典模板里的 `{占位符}` 必须在渲染处代入，漏一个用户就看到 `{chapters}`。
 *
 * 这条约束写在 `src/app/[locale]/ai/page.tsx` 的注释里（「占位符漏到界面上，用户看到的
 * 就是『基于 {chapters} 篇章知识库』」），但整仓测试没有一处守着它：把
 * `withChapterCount()` 换成裸文案、或者只代入一半，全套门禁照绿。
 *
 * 词表从词典模块的取值里抽（新增词条自动纳入）。字典模块清单沿用
 * `scripts/check-dead-copy.mjs` 的口径（`src/lib/i18n*.ts`，排除测试），并由
 * `词表覆盖 src/lib 里的每一个字典模块` 那条用例钉住——本条用例的由来就是这个：
 * 第一版只读 `i18n.ts`，把周报 `aria-label` 的 `{n}` 摘掉后代入，测试全绿，
 * 因为 `weeklySummaryTpl` 住在 `i18n-stats.ts` 里。
 *
 * 判定按**占位符名**而不是整条模板：只代入一半（`{chapters}` 换成数字、`{done}` 忘了）
 * 时整条模板已经不再连续出现，按模板比对会漏——这条路第一版变异就漏过。代价是组件里
 * 自建的字典（如 `market-ticker.tsx` 的 `const DICT`）不在清单口径内，它的 `{n}` 恰好
 * 与词典重名才顺带被覆盖；一个只用「词典里从没出现过的占位符名」的组件文案仍在网外。
 *
 * 三条渲染面各自成断言：
 * 1. 构建产物的可见文本（全部预渲染页面）；
 * 2. 构建产物里的可见属性（`placeholder` / `aria-label` / `title` / `alt`——读屏与
 *    输入框提示走这条通道，文本节点里没有它们；目前尚无页面在服务端就渲染带占位符的
 *    属性，这条由 `词表、产物面、判定器三样都不空转` 里的夹具自证）；
 * 3. 水合后的 DOM（只在客户端挂载的文案，服务端 HTML 里根本没有它们）。
 *
 * 误报侧两处处理：① 知识库课文合法带着花括号（Python f-string 与 `1:{ratio}` 盈亏比
 * 标注），判定前先丢 `<pre>` / `<code>`；② 更新日志页渲染 git 提交标题与发布说明正文，
 * 那是仓库原文而不是词典代入的产物（本门禁上线第一天就把自己的 commit 标题判成泄漏），
 * 这类节点整棵用 `data-copy-source` 标出并跳过。RSC payload 里未代入的模板属正常，
 * `<script>` 整段丢掉。
 */

const APP_OUT = path.join(process.cwd(), ".next", "server", "app");
const TOKEN_RE = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
const VISIBLE_ATTRS = ["placeholder", "aria-label", "title", "alt"] as const;

/** 每个字典模块 → 各 locale 的取值。加新模块必须同时加到这里。 */
const DICT_SOURCES: Array<{ file: string; locales: string[]; read: (locale: string) => unknown }> = [
  { file: "src/lib/i18n.ts", locales: [...LOCALES], read: getDict },
  { file: "src/lib/i18n-stats.ts", locales: [...LOCALES], read: getStatsDict },
];

function placeholderTokens(): Set<string> {
  const tokens = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === "string") {
      for (const match of value.matchAll(TOKEN_RE)) tokens.add(match[1]);
      return;
    }
    if (value && typeof value === "object") {
      for (const child of Object.values(value)) visit(child);
    }
  };
  for (const source of DICT_SOURCES) {
    for (const locale of source.locales) visit(source.read(locale));
  }
  return tokens;
}

function walkFiles(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(absolute, base);
    return [path.relative(base, absolute).split(path.sep).join("/")];
  });
}

/** React 文本节点之外的自由文本容器；这些节点整棵跳过，见 `dropCopySourceSubtrees`。 */
const COPY_SOURCE_ATTR = "data-copy-source";
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr",
]);

/**
 * 整棵丢掉被 `data-copy-source` 标记的子树。
 *
 * 这个标记只给「仓库里来的原文」用：更新日志页渲染 git 提交标题与发布说明正文，
 * 那里出现 `{chapters}` 是内容本身（本次门禁上线第一天就是被自己的 commit 标题
 * 判红的），不是词典没代入。跳过按标签配平做，`<li>` 里再套 `<li>` 也不会截错。
 */
function dropCopySourceSubtrees(html: string): string {
  const opener = new RegExp(
    `<([a-zA-Z][\\w-]*)\\b[^>]*\\b${COPY_SOURCE_ATTR}="[^"]*"[^>]*>`,
    "gi"
  );
  let out = html;
  let match: RegExpExecArray | null;
  opener.lastIndex = 0;
  while ((match = opener.exec(out)) !== null) {
    const tag = match[1];
    const start = match.index;
    if (VOID_TAGS.has(tag.toLowerCase())) {
      out = out.slice(0, start) + out.slice(start + match[0].length);
      opener.lastIndex = start;
      continue;
    }
    const scan = new RegExp(`</?${tag}\\b[^>]*>`, "gi");
    scan.lastIndex = start + match[0].length;
    let depth = 1;
    let end = out.length;
    let next: RegExpExecArray | null;
    while ((next = scan.exec(out)) !== null) {
      if (next[0].startsWith("</")) {
        depth -= 1;
        if (depth === 0) {
          end = next.index + next[0].length;
          break;
        }
      } else if (!next[0].endsWith("/>")) {
        depth += 1;
      }
    }
    out = out.slice(0, start) + out.slice(end);
    opener.lastIndex = start;
  }
  return out;
}

/** 用户可见文本：文本节点 + 可见属性。脚本整段丢掉——RSC payload 原样带着未代入的模板。
 *  标签名大小写不敏感，这些正则一律带 `i`（CodeQL 把不带 `i` 的 `<script>` 剥离判成高危：
 *  一个 `<SCRIPT>` 就能绕过剥离，等于门禁自己开了口子）。 */
function htmlSurface(html: string): string {
  const body = dropCopySourceSubtrees(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
  );
  const attributes: string[] = [];
  for (const tag of body.matchAll(/<\w[\w-]*(\s[^>]*)>/gi)) {
    for (const attr of tag[1].matchAll(
      new RegExp(`\\b(?:${VISIBLE_ATTRS.join("|")})="([^"]*)"`, "gi")
    )) {
      attributes.push(attr[1]);
    }
  }
  const text = body
    .replace(/<pre[\s\S]*?<\/pre>/gi, " ")
    .replace(/<code[\s\S]*?<\/code>/gi, " ")
    .replace(/<[^>]*>/gi, " ");
  return `${text}\n${attributes.join("\n")}`;
}

function leaksIn(surface: string, tokens: Set<string>): string[] {
  const found = new Set<string>();
  for (const match of surface.matchAll(TOKEN_RE)) {
    if (tokens.has(match[1])) found.add(`{${match[1]}}`);
  }
  return [...found].sort();
}

function prerenderedPages(): string[] {
  if (!existsSync(APP_OUT)) throw new Error(`未找到 ${APP_OUT}，请先 npm run build`);
  return walkFiles(APP_OUT)
    .filter((file) => file.endsWith(".html"))
    .sort();
}

const tokens = placeholderTokens();
const pages = prerenderedPages();

/** 7 天各 19 分钟：1140 秒不会被取整成 0，也不是任何整数小时，界面上必须有它。 */
const SEED_DAY_SECONDS = Array.from({ length: 7 }, () => 1_140);

/**
 * 打开页面并先塞一份 7 天学习台账。趋势图与周报的 `aria-label`、周度摘要行都是从
 * `{n}` 这类模板代入出来的，没有本地数据时这些节点根本不渲染——变异打在上面是空枪。
 */
async function openWithStudyHistory(page: Page, route: string) {
  const ledger = JSON.stringify(
    Object.fromEntries(
      SEED_DAY_SECONDS.map((seconds, index) => [
        shiftDate(localDateStr(), index - 6),
        { read: seconds },
      ])
    )
  );
  await page.addInitScript((value) => {
    window.localStorage.setItem("tb-study-time", value);
  }, ledger);
  await page.goto(route, { waitUntil: "load" });
  await page.waitForTimeout(500);
}

/** 水合后浏览器里的可见面：与 `htmlSurface` 同口径——文本节点 + 可见属性，跳过脚本与 `data-copy-source` 子树。 */
async function domSurface(page: {
  evaluate: (fn: () => string) => Promise<string>;
}): Promise<string> {
  return page.evaluate(() => {
    const parts: string[] = [];
    const walk = (element: Element) => {
      for (const attr of ["placeholder", "aria-label", "title", "alt"]) {
        const value = element.getAttribute(attr);
        if (value) parts.push(value);
      }
      for (const child of Array.from(element.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          parts.push(child.nodeValue ?? "");
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        const node = child as Element;
        const tag = node.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") continue;
        if (node.hasAttribute("data-copy-source")) continue;
        walk(node);
      }
    };
    if (document.body) walk(document.body);
    return parts.join("\n");
  });
}

test.describe("占位符不泄漏到界面", () => {
  test("词表、产物面、判定器三样都不空转", () => {
    // 词表退化成空集时，后面所有断言都会静默变绿。
    expect(tokens.size).toBeGreaterThanOrEqual(30);

    // 反例自证 1：真实词条里的占位符必须被抓住。
    expect(leaksIn("近 7 天共学 {n} 分钟，日均 {avg} 分钟", tokens)).toEqual(
      expect.arrayContaining(["{n}"])
    );
    // 反例自证 2：不在词表里的花括号不许误伤（课文代码示例、盈亏比标注）。
    expect(leaksIn("requests.get(f\"{BASE_URL}/klines\") · 盈亏比 1:{ratio}", tokens)).toEqual([]);
    // 反例自证 3：文本节点之外的通道也要能走通（属性里的漏代入）。
    expect(leaksIn(htmlSurface('<div aria-label="近 7 天 {n} 分钟"></div>'), tokens)).toContain("{n}");
    // 反例自证 4：`<code>` 里的占位符名不算泄漏。
    expect(leaksIn(htmlSurface('<p><code>for {n} in range(3)</code></p>'), tokens)).toEqual([]);
    // 反例自证 5：RSC payload 里的未代入模板不算泄漏。
    expect(
      leaksIn(htmlSurface('<body><p>正常</p><script>"a":"{n}"</script></body>'), tokens)
    ).toEqual([]);
    // 反例自证 6：`data-copy-source` 标出的原文子树整棵跳过，未标记的兄弟照查——
    // 这条同时防两种坏法：截不干净（`{avg}` 混进来）与截过头（连 `{n}` 都没了）。
    expect(
      leaksIn(
        htmlSurface(
          '<ul><li data-copy-source="commit"><p>{avg}</p></li><li>{n}</li></ul>' +
            '<div data-copy-source="note"><span>{days}</span></div>'
        ),
        tokens
      )
    ).toEqual(["{n}"]);
    // 反例自证 7：标签名大小写不敏感——`<SCRIPT>` / `<CODE>` 都不许绕过对应的剥离。
    expect(
      leaksIn(htmlSurface('<p>正常</p><SCRIPT>var a="{n}"</SCRIPT>'), tokens)
    ).toEqual([]);
    expect(leaksIn(htmlSurface("<p><CODE>{n}</CODE></p>"), tokens)).toEqual([]);

    expect(pages.length).toBeGreaterThan(400);
  });

  test("词表覆盖 src/lib 里的每一个字典模块", () => {
    const dictFiles = walkFiles(path.join(process.cwd(), "src", "lib"))
      .filter((file) => /^i18n[^/]*\.ts$/.test(file) && !file.includes(".test."))
      .map((file) => `src/lib/${file}`)
      .sort();
    expect(
      DICT_SOURCES.map((source) => source.file).sort(),
      `字典模块清单与 src/lib 实际文件不一致：${dictFiles.join(", ")}`
    ).toEqual(dictFiles);
  });

  test("全部预渲染页面：文本与可见属性里没有残留的 {占位符}", () => {
    const failures: string[] = [];
    for (const file of pages) {
      const html = readFileSync(path.join(APP_OUT, file), "utf-8");
      for (const leak of leaksIn(htmlSurface(html), tokens)) {
        failures.push(`${file} → ${leak}`);
      }
    }
    expect(failures.slice(0, 12), failures.join("\n")).toEqual([]);
  });

  // 水合后才有文案的表面：只在客户端挂载的卡片与 toast，服务端 HTML 里根本没有它们。
  const HYDRATED_ROUTES = [
    "/zh/ai",
    "/zh/stats",
    "/zh/path",
    "/zh/replay",
    "/en/stats",
    "/zh/glossary",
  ];

  for (const route of HYDRATED_ROUTES) {
    test(`${route} 水合后仍无残留 {占位符}`, async ({ page }) => {
      await openWithStudyHistory(page, route);
      expect(leaksIn(await domSurface(page), tokens), route).toEqual([]);
    });
  }

  test("/zh/stats 水合后渲染的本地数据文案无残留 {占位符}", async ({ page }) => {
    // 这一条是整组水合用例的接地线：周报的 `aria-label` 与摘要行由本地台账算出来，
    // 服务端快照是空的，所以它们只在水合后存在。断言「算出来的那句真的在界面上」，
    // 否则上面的用例可以在数据通路坏掉时静默退化成一遍 chrome 文案复读。
    await openWithStudyHistory(page, "/zh/stats");
    const surface = await domSurface(page);
    const total = weekMinutes(SEED_DAY_SECONDS.reduce((a, b) => a + b, 0));
    const expected = getStatsDict("zh").weeklySummaryTpl
      .replace("{n}", String(total))
      .replace("{avg}", String(Math.round(total / SEED_DAY_SECONDS.length)));
    expect(surface, "本地台账没有渲染出周报文案（水合或数据通路失效）").toContain(expected);
    expect(leaksIn(surface, tokens), "/zh/stats").toEqual([]);
  });

  test("回访提醒 toast 的 {days} 代入正确", async ({ page }) => {
    // 这条同时是水合断言不空转的自证：toast 只在客户端挂载，服务端 HTML 里没有它，
    // 且 `if (!open) return null`——拿不到 `data-testid` 就直接失败，不会静默跳过。
    await page.addInitScript(() => {
      sessionStorage.setItem("tb-return-nudge-pending", "1");
    });
    await page.goto("/zh/stats", { waitUntil: "load" });
    const toast = page.getByTestId("return-nudge-toast");
    await expect(toast).toBeVisible({ timeout: 10_000 });
    const text = await toast.innerText();
    expect(leaksIn(text, tokens), text).toEqual([]);
    // 天数为正整数才说明代入真的发生过（`setDays` 兜底 7）
    expect(text).toMatch(/\d/);
  });
});
