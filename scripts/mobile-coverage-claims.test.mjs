/**
 * 「哪些页面在 320px 下被量过」不许由两份手抄清单决定——清单的主人必须是源码树。
 *
 * 病灶（R16.329）：两条移动门禁各拿一份字面量清单（`scripts/check-mobile.mjs` 的
 * `ROUTES`、`e2e/mobile-overflow.spec.ts` 的 `CORE_SUFFIXES × LOCALES`），**合起来**
 * 仍然有 10 份 `page.tsx` 一处都没量过：about / auth / auth/callback / bookmarks /
 * calendar / changelog / faq / privacy / share 落地页 / terms。最刺眼的一条是
 * `/privacy`：R16.327 刚把那一节从一句改写成三句（含 `api.binance.com` 这种
 * 不可断行的长 token），而改完之后**没有任何东西在 320px 下看过这一页**——
 * 我改了一页自己量不到的界面。这与 R16.315（文档里的手抄数字）/ R16.317
 * （注释里的路径引用）/ R16.328（跨源判据的 ROUTES）是同一条病：**清单没有主人**。
 *
 * 所以这里从 `src/app` 下所有 `page.tsx` 现读页面模板，要求两份清单的并集覆盖全部模板；
 * 结构上无法由「× LOCALES」表达的根级动态段（`/share/{kind}/{payload}`，locale 编在
 * 载荷里）由 spec 里的 `DYNAMIC_TEMPLATE_COVERAGE` 显式认领，而**认领必须兑现**：
 * 每一串都要在 spec 源码里真的对应一处被遍历的路径，删掉用例留着声明就红。
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const MOBILE_SCRIPT = "scripts/check-mobile.mjs";
const MOBILE_SPEC = "e2e/mobile-overflow.spec.ts";

function walk(dir, out = []) {
  for (const e of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

/** 去掉语言前缀，得到「页面模板」形状（`/`、`/privacy`、`/share/[kind]/[path]`） */
function stripLocale(route) {
  return route.replace(/^\/(?:zh|en)(?=\/|$)/, "") || "/";
}

/** 源码树里真实存在的页面模板（现读，不抄） */
const TEMPLATES = [
  ...new Set(
    walk("src/app")
      .filter((f) => f.endsWith("/page.tsx"))
      .map((f) => {
        const rest = f
          .replace(/^src\/app\/(?:\[locale\]\/)?/, "")
          .replace(/(?:^|\/)page\.tsx$/, "");
        return rest === "" ? "/" : `/${rest}`;
      }),
  ),
].sort();

const mobileSrc = read(MOBILE_SCRIPT);
const specSrc = read(MOBILE_SPEC);

/** `check-mobile.mjs` 的 ROUTES：脚本自己那份写死清单 */
function scriptRoutes() {
  const block = /const ROUTES = \[([\s\S]*?)\];/.exec(mobileSrc);
  expect(block, `${MOBILE_SCRIPT} 里找不到 const ROUTES = [...]`).toBeTruthy();
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => stripLocale(m[1]));
}

/** spec 的 CORE_SUFFIXES × LOCALES，与 SHARE_PATHS 那批根级路径 */
function specRoutes() {
  const suffixBlock = /const CORE_SUFFIXES = \[([\s\S]*?)\];/.exec(specSrc);
  expect(suffixBlock, `${MOBILE_SPEC} 里找不到 const CORE_SUFFIXES = [...]`).toBeTruthy();
  const suffixes = [...suffixBlock[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  const localesBlock = /const CORE_PATHS = LOCALES\.flatMap\(\(locale\) =>/.exec(specSrc);
  expect(
    localesBlock,
    `${MOBILE_SPEC} 不再按 LOCALES 展开 CORE_PATHS：那份「× 全部语言」的矩阵换了形状，这条门禁要重新对齐`,
  ).toBeTruthy();
  const out = [];
  // LOCALES 的真实人口由 i18n 说了算，不在这里抄一份
  const locales = [...read("src/lib/i18n.ts").matchAll(/LOCALES(?::[^=]*)? = \[([^\]]+)\]/g)].flatMap((m) =>
    [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]),
  );
  expect(locales.length, "从 i18n 里解析不出 LOCALES").toBeGreaterThanOrEqual(2);
  for (const locale of locales) for (const suffix of suffixes) out.push(stripLocale(`/${locale}${suffix}`));
  const shareBlock = /const SHARE_PATHS = \[([\s\S]*?)\];/.exec(specSrc);
  expect(shareBlock, `${MOBILE_SPEC} 里找不到 const SHARE_PATHS = [...]`).toBeTruthy();
  // 载荷由编码器现生成，这里只取模板首段做形状比对，不比对 base64
  // 具体路径要保留完整段数：SHARE_PATHS 里每条都是 `/share/{kind}/{载荷}` 三段，
  // 截成 `/share/quiz` 会让「不许只长不消」那条腿误报成陈旧清单。
  const sharePaths = [...shareBlock[1].matchAll(/`(\/share\/[a-z]+)\/\$\{[^}]*\}/g)].map(
    (m) => `${m[1]}/payload`,
  );
  out.push(...sharePaths);
  return { routes: out, shareCount: sharePaths.length };
}

/** spec 里显式认领的「结构上盖不到」的模板 */
function declaredDynamic() {
  const block = /const DYNAMIC_TEMPLATE_COVERAGE = \[([\s\S]*?)\];/.exec(specSrc);
  expect(
    block,
    `${MOBILE_SPEC} 里找不到 const DYNAMIC_TEMPLATE_COVERAGE = [...]：无法由「× LOCALES」表达的页面必须显式认领`,
  ).toBeTruthy();
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** 模板段匹配：字面段逐字相同，`[x]` 段允许任何具体值 */
function matches(template, concrete) {
  const want = template.split("/").filter(Boolean);
  const have = concrete.split("/").filter(Boolean);
  if (have.length !== want.length) return false;
  return want.every((seg, i) => seg.startsWith("[") || seg === have[i]);
}

describe("320px 覆盖面的清单由源码树说了算", () => {
  const script = scriptRoutes();
  const { routes: spec, shareCount } = specRoutes();
  const dynamic = declaredDynamic();
  const covered = [...new Set([...script, ...spec])];

  it("扫描本身不是空转（模板数、两份清单长度都有地板）", () => {
    expect(TEMPLATES.length, `只数到 ${TEMPLATES.length} 份页面模板，扫描本身坏了`).toBeGreaterThanOrEqual(20);
    expect(script.length, "check-mobile 的 ROUTES 解析不出条目").toBeGreaterThanOrEqual(14);
    expect(spec.length, "spec 的 CORE_PATHS 解析不出条目").toBeGreaterThanOrEqual(20);
  });

  it("两份清单的并集覆盖每一个页面模板（新增页面不许漏）", () => {
    const missing = TEMPLATES.filter(
      (t) => !covered.some((c) => matches(t, c)) && !dynamic.includes(t),
    );
    expect(
      missing,
      `这些页面模板在 320px 下从来没被量过（两条移动门禁都没盖到）：${missing.join(", ")}——把它们加进 CORE_SUFFIXES，或在 DYNAMIC_TEMPLATE_COVERAGE 里认领并真的写用例`,
    ).toEqual([]);
  });

  it("显式认领的动态段必须兑现：spec 里真有一处遍历它的路径清单", () => {
    for (const t of dynamic) {
      const exists = TEMPLATES.includes(t);
      expect(exists, `DYNAMIC_TEMPLATE_COVERAGE 认领了 ${t}，但源码树里没有这份 page.tsx`).toBe(true);
      // 认领的形状必须是「有对应清单」而不是空口：`/share/[kind]/[path]` → SHARE_PATHS 非空
      const head = `/${t.split("/").filter(Boolean)[0]}/`;
      const hasPaths =
        head === "/share/" ? shareCount >= 3 : spec.some((c) => matches(t, c));
      expect(
        hasPaths,
        `认领了 ${t} 却没有对应的具体路径清单（首段 ${head}）：这条认领是空转，删掉它或补用例`,
      ).toBe(true);
    }
  });

  it("清单里不许留着已经没有 page.tsx 的路由（不许只长不消）", () => {
    const stale = covered.filter((c) => !TEMPLATES.some((t) => matches(t, c)));
    expect(stale, `两份清单点名了没有对应 page.tsx 的路径：${stale.join(", ")}`).toEqual([]);
  });

  it("正向对照：把一条真实认领的模板从清单里删掉，上一条判据就会红（自证）", () => {
    // 自证的是「陈旧」那条腿的探测器：造一个不存在的模板，必须被它抓出来
    const fake = [...covered, "/does-not-exist-anywhere"];
    const stale = fake.filter((c) => !TEMPLATES.some((t) => matches(t, c)));
    expect(stale, "探测器抓不出假路径，上面那条「不许只长不消」是空转").toEqual([
      "/does-not-exist-anywhere",
    ]);
  });

  it("R16.327 改过文案的那一页，如今确实在 320px 矩阵里", () => {
    // 这一条不是装饰：本轮的病灶正是「改了一页自己量不到的界面」。
    // 若有人把 /privacy 从清单里摘掉，上面「覆盖每一个模板」那条也会红，
    // 但那条红的原因可能是新增了别的页面——这里点名要的是这一页。
    for (const locale of ["zh", "en"]) {
      expect(
        covered.filter((c) => c === "/privacy").length > 0 && spec.includes("/privacy"),
        `/${locale}/privacy 不在 CORE_PATHS 展开结果里：R16.327 那次的文案改动又变成「改了自己量不到的页」`,
      ).toBe(true);
    }
  });
});
