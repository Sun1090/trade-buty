/**
 * R16.333：「站内有哪些页面」这件事只能有一个主人——源码树。
 *
 * 病灶（承 R16.329 / R16.330 同一条病）：`src/app` 下的 `page.tsx` 是页面清单的**唯一事实来源**，
 * 但每一条巡检都在自己文件里再抄一份「有哪些页」：`e2e/mobile-overflow.spec.ts` 抄一份
 * （CORE_SUFFIXES × LOCALES）、`scripts/check-mobile.mjs` 抄一份（ROUTES）、
 * `e2e/runtime-health.spec.ts` 再抄一份（ROUTES）。抄一份就多一处「只长不消」的地方——
 * R16.329 那次是两条移动门禁合起来仍有 10 份 page.tsx 从没量过，R16.333 这次是水合巡检漏了
 * 5 个模板（about / auth/callback / faq / knowledge 章节页 / terms）。
 *
 * 所以这里把**推导器**抽成一份：模板枚举、locale 剥离、模板段匹配、路由字面量解析。
 * 判据（谁必须覆盖谁、地板取多少）留在各自的门禁文件里——那是各条巡检自己的口径，
 * 不该被一个共享模块统一规定。共享的只有尺子。
 *
 * 为什么必须共享而不是各写各的：R16.333 之前 `matches()` 的形状在两份文件里各抄了一遍，
 * 一旦有人把动态段的匹配规则改宽（例如允许前缀匹配），一条门禁红、另一条静默通过，
 * 「覆盖面」这个词就有两个含义。
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/** 递归列出目录下的文件（相对 root 的 posix 路径）。 */
export function walkFiles(root, dir, out = []) {
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(root, rel, out);
    else out.push(rel);
  }
  return out;
}

/**
 * 源码树里真实存在的页面模板，形状是 Next 的 page 文件路径：
 * `/`、`/privacy`、`/knowledge/[chapter]/[doc]`、`/share/[kind]/[path]`。
 * `[locale]` 段被剥掉——语言是同一份模板的参数，不是另一个页面。
 */
export function listPageTemplates(root) {
  const files = walkFiles(root, "src/app").filter((f) => f.endsWith("/page.tsx"));
  return [
    ...new Set(
      files.map((f) => {
        const rest = f
          .replace(/^src\/app\/(?:\[locale\]\/)?/, "")
          .replace(/(?:^|\/)page\.tsx$/, "");
        return rest === "" ? "/" : `/${rest}`;
      }),
    ),
  ].sort();
}

/**
 * 去掉语言前缀，得到「页面模板」形状。语言列表由 `src/lib/i18n.ts` 说了算，
 * 这里**不抄 LOCALES**：只剥掉「形如两段小写语言码的前缀」会让 `/de/...` 这类
 * 尚未登记的路径被误剥，所以调用方要么传 locales，要么接受默认 zh/en。
 */
export function stripLocale(route, locales) {
  const pattern = locales?.length
    ? new RegExp(`^/(?:${locales.join("|")})(?=/|$)`)
    : /^\/(?:zh|en)(?=\/|$)/;
  return route.replace(pattern, "") || "/";
}

/** 从 `src/lib/i18n.ts` 现读 LOCALES，不在门禁里手抄一份语言清单。 */
export function readLocalesFromI18n(root, rel = "src/lib/i18n.ts") {
  const source = readFileSync(path.join(root, rel), "utf8");
  return [
    ...source.matchAll(/LOCALES(?::[^=]*)? = \[([^\]]+)\]/g),
  ].flatMap((match) => [...match[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
}

/**
 * 模板段匹配：字面段逐字相同，`[x]` 段允许任何具体值。
 * 段数必须相等——`/share/quiz` 不算命中 `/share/[kind]/[path]`，
 * 否则「章节页从没量过」会被「课文页量过」冒充（R16.332 的教训：段数比对要保留）。
 */
export function templateMatches(template, concrete) {
  const want = template.split("/").filter(Boolean);
  const have = concrete.split("/").filter(Boolean);
  if (want.length !== have.length) return false;
  return want.every((seg, i) => seg.startsWith("[") || seg === have[i]);
}


/**
 * 一份「具体 URL 清单」对「模板全集」的覆盖结果。
 * 返回未覆盖的模板与清单里已经没有对应 page.tsx 的条目，两个方向都算，
 * 因为「漏页」与「只长不消」是同一份清单的两种病，调用方各判各的。
 */
export function diffTemplateCoverage({ templates, routes }) {
  const covered = routes.filter((route) =>
    templates.some((template) => templateMatches(template, route)),
  );
  return {
    missing: templates.filter((template) => !covered.some((route) => templateMatches(template, route))),
    stale: routes.filter((route) => !templates.some((template) => templateMatches(template, route))),
  };
}
/**
 * 把注释整块涂白，但保住行号（违规要报出第几行）。
 *
 * 与 `scripts/e2e-wait-hygiene.test.mjs` 同族同理由：**清单里带注释是常态**，而注释里的
 * 反引号会被字面量正则当成条目。R16.333 实测——往 `ROUTES` 里加一段解释性注释（内含
 * 用反引号包起来的目录名与文件名），解析器就把它们读成三条「路由」，覆盖面当场虚报。
 * 行首空格只能用 `[ \t]*`：写成 `\s*` 时那个 `\s` 会把换行也吃掉，行数就变了
 * （第三十八轮被「台账点名的行号要对回尺子现读的集合」当场抓出来）。
 */
export function blankComments(source) {
  return String(source)
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

/**
 * 取一份源码里 `const NAME = [...]` 数组中的字符串字面量。
 *
 * 正则刻意接受**单行与多行**两种写法（R16.329 那轮踩过：`\[([\s\S]*?)\n\];` 匹配不了
 * 单行数组，四处一起放宽）。`as const` 后缀也要能穿过，否则 e2e spec 里的清单解析不到。
 *
 * **结尾必须紧贴 `]` + 可选 `as const` + `;`**：第一版写成 `\[([\s\S]*?)\];`，
 * 而 `e2e/runtime-health.spec.ts` 的 ROUTES 以 `] as const;` 结尾——非贪婪一路越过真正的
 * 结尾，把后面 `values`、`localhost`、`blockedbyclient` 等无关字面量一起吞成「路由」，
 * 22 条被读成 55 条。**越界比匹配不到危险得多**：匹配不到会红，越界会让覆盖面看起来很好。
 * 解析不到返回 null，由调用方决定是判红还是换形状——共享模块不替别人下判决。
 * 「不像路径的条目」由 `nonPathLiterals` 单独量出来给调用方判红，这里不静默过滤。
 */
export function readRouteLiterals(source, name) {
  const block = new RegExp(
    String.raw`const ${name}(?::[^=\n]*)? = \[([\s\S]*?)\][ \t]*(?:as const[ \t]*)?;`,
  ).exec(blankComments(source));
  if (!block) return null;
  // 允许空串条目：`e2e/mobile-overflow.spec.ts` 的 CORE_SUFFIXES 第一项就是 ""（首页）。
  // 用 `+` 时那对空引号匹配不上，后面的引号就两两错位配对，整份清单读成乱码——
  // 这类错不会红在「解析不到」上，只会红在「覆盖面突然少了一大片」，更难查。
  const literals = [...block[1].matchAll(/["'`]([^"'`]*)["'`]/g)].map((m) => m[1]);
  return literals;
}

/**
 * 把「清单里混进了不像路由的东西」这件事量出来。
 * 判据不放在 `readRouteLiterals` 里，因为有的清单存的是后缀（`/privacy`）而不是完整 URL，
 * 有的清单里合法地带着非路径常量——由调用方决定什么叫它那一族的合法形状。
 */
export function nonPathLiterals(literals) {
  return (literals ?? []).filter((value) => !value.startsWith("/"));
}
