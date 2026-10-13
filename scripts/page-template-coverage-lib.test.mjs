/**
 * R16.333：这把尺子自己也要有自证——它现在被三条门禁共用，量错一次就是三条一起错。
 *
 * 最要紧的一条是**解析越界**：`readRouteLiterals` 的第一版把结尾写成 `\[([\s\S]*?)\];`，
 * 而 `e2e/runtime-health.spec.ts` 的 ROUTES 以 `] as const;` 结尾——非贪婪一路越过真正的结尾，
 * 把后面 `values`、`localhost`、`blockedbyclient` 等无关字面量一起吞成「路由」，
 * **22 条被读成 55 条**。匹配不到会红，越界不会：它让覆盖面看起来很好。
 * 所以这里必须有一条「越界就红」的夹具，而不是只测「能解析到」。
 */
import { describe, expect, it } from "vitest";
import {
  diffTemplateCoverage,
  listPageTemplates,
  nonPathLiterals,
  readLocalesFromI18n,
  readRouteLiterals,
  stripLocale,
  templateMatches,
} from "./page-template-coverage-lib.mjs";

const root = process.cwd();

describe("页面模板推导器（三条门禁共用的那把尺子）", () => {
  it("源码树里确实数得出页面模板（扫描本身不是空转）", () => {
    const templates = listPageTemplates(root);
    expect(templates.length).toBeGreaterThanOrEqual(20);
    // 点名几条形状不同的：根页、普通页、两级动态段、非 [locale] 树下的动态段
    for (const t of ["/", "/privacy", "/knowledge/[chapter]/[doc]", "/share/[kind]/[path]"]) {
      expect(templates, `模板清单里没有 ${t}`).toContain(t);
    }
  });

  it("LOCALES 由 i18n 现读，不在门禁里手抄", () => {
    const locales = readLocalesFromI18n(root);
    expect(locales.length).toBeGreaterThanOrEqual(2);
    expect(locales).toContain("zh");
  });

  it("stripLocale 只剥登记过的语言，不剥看起来像语言码的段", () => {
    expect(stripLocale("/zh/privacy", ["zh", "en"])).toBe("/privacy");
    expect(stripLocale("/de/privacy", ["zh", "en"])).toBe("/de/privacy");
    // 前缀相似不许误伤：/zhenghe 不是 /zh + /henghe
    expect(stripLocale("/zhenghe", ["zh", "en"])).toBe("/zhenghe");
    expect(stripLocale("/zh", ["zh", "en"])).toBe("/");
  });

  it("templateMatches 要求段数相同（课文页不许冒充章节页）", () => {
    expect(templateMatches("/knowledge/[chapter]", "/knowledge/getting-started")).toBe(true);
    // 这一条是 R16.332 那轮的教训：SHARE_PATHS 截成两段会让三段模板比对不上还看不出来
    expect(templateMatches("/knowledge/[chapter]", "/knowledge/getting-started/first-trade")).toBe(false);
    expect(templateMatches("/share/[kind]/[path]", "/share/quiz")).toBe(false);
    expect(templateMatches("/share/[kind]/[path]", "/share/quiz/abc")).toBe(true);
    expect(templateMatches("/", "/zh")).toBe(false);
  });

  it("readRouteLiterals 接受单行、多行、类型标注与 as const 四种写法", () => {
    expect(readRouteLiterals('const A = ["/x", "/y"];', "A")).toEqual(["/x", "/y"]);
    expect(readRouteLiterals('const A = [\n  "/x",\n];', "A")).toEqual(["/x"]);
    expect(readRouteLiterals('const A: string[] = ["/x"];', "A")).toEqual(["/x"]);
    expect(readRouteLiterals('const A = ["/x"] as const;', "A")).toEqual(["/x"]);
    expect(readRouteLiterals('const A = [];', "B")).toBe(null);
    // 名字不许前缀互认：找 ROUTES 不许命中 CLICK_ROUTES
    expect(readRouteLiterals('const CLICK_ROUTES = ["/c"];', "ROUTES")).toBe(null);
  });

  it("越界回归：清单之后的字面量不许被当成路由吞进来", () => {
    // 这就是咬过我的那份形状：ROUTES 以 `] as const;` 结尾，后面还跟着别的数组
    const source = [
      'const ROUTES = [',
      '  "/zh",',
      '  "/en",',
      "] as const;",
      "",
      "const values = {",
      '  "tb-progress": "1",',
      '  "localhost": "x",',
      "};",
    ].join("\n");
    const routes = readRouteLiterals(source, "ROUTES");
    expect(routes, "解析越界：把 ROUTES 之后的字面量读成了路由").toEqual(["/zh", "/en"]);
    expect(nonPathLiterals(routes)).toEqual([]);
  });

  it("nonPathLiterals 能点名混进清单的非路径条目（探测器不静默过滤）", () => {
    expect(nonPathLiterals(["/zh", "localhost", "blockedbyclient"])).toEqual([
      "localhost",
      "blockedbyclient",
    ]);
    expect(nonPathLiterals(null)).toEqual([]);
  });

  it("空串条目（首页）不许让引号两两错位配对", () => {
    // `e2e/mobile-overflow.spec.ts` 的 CORE_SUFFIXES 第一项就是 ""。字面量正则若要求
    // 至少一个字符，那对空引号匹配不上，后面的条目就会两两错位读成乱码——
    // 它不会红在「解析不到」，只会红在「覆盖面突然少一大片」。
    const source = ['const SUFFIXES = ["", "/about", "/faq"];'].join("\n");
    expect(readRouteLiterals(source, "SUFFIXES")).toEqual(["", "/about", "/faq"]);
  });

  it("清单里的注释不许被读成条目（注释里带反引号是常态）", () => {
    // 咬过我的第二种越界：往 ROUTES 里加一段解释性注释，注释里用反引号包了文件名，
    // 解析器把 `` `page.tsx` `` 读成一条路由，覆盖面当场虚报。
    const source = [
      "const ROUTES = [",
      '  "/zh",',
      "  /**",
      "   * 解释一下这一族的来源，内含 `src/app` 与 `page.tsx` 两个反引号。",
      "   */",
      '  "/en",',
      "  // 行注释里也有 `check-mobile.mjs`",
      '  "/zh/privacy",',
      "] as const;",
    ].join("\n");
    expect(readRouteLiterals(source, "ROUTES")).toEqual(["/zh", "/en", "/zh/privacy"]);
  });

  it("diffTemplateCoverage 两个方向都报：漏页与只长不消", () => {
    const templates = ["/", "/privacy", "/gone"];
    const routes = ["/", "/privacy"];
    const { missing, stale } = diffTemplateCoverage({ templates, routes });
    expect(missing).toEqual(["/gone"]);
    expect(stale).toEqual([]);
    // 反向：清单里留着没有 page.tsx 的路径必须被点名
    const other = diffTemplateCoverage({ templates: ["/"], routes: ["/", "/ghost"] });
    expect(other.stale).toEqual(["/ghost"]);
  });
});
