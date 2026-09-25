/**
 * R16.188：客户端组件里写死的站内绝对链接必须带语种前缀。
 *
 * 这一站所有页面都住在 `/{locale}` 下（`src/app/[locale]/`），根级没有对应路由。
 * 未加前缀的地址不会 404——`src/proxy.ts` 会把它 307 到 `/{语种}/…`，而那个语种取自
 * `tb-lang` cookie、缺省 `en`（实测：无 cookie 时 `/replay` → `/en/replay`，
 * `tb-lang=zh` 时才 → `/zh/replay`）。于是 `href="/replay"` 的真实后果是
 * **在用户毫无提示的情况下换掉界面语种**：中文页面上那颗「继续学习」把只认 URL 的访客
 * 送去英文回放页，而屏幕上其余每一句（包括这条提示自己的文案）都按 URL 的语种渲染。
 * 组件自己就从路径里读 locale（与 `sync-summary-toast` 同一套写法），加上前缀即可。
 *
 * `check:links` 抓不到这一类：它读构建产物里的静态 HTML，而 toast 没弹出时组件直接
 * `return null`，服务端 HTML 里根本没有这个节点。所以这一半得由源码层守。
 *
 * 口径写清楚，别夸成「所有链接都查过」：
 * - 认的是**字面量绝对路径**：`href="/x"`、`href={"/x"}`、``href={`/x`} ``。
 *   以 `/${` 开头的模板串是带变量语种前缀的正常写法，跳过。
 * - 第一段必须是 `LOCALES` 里的语种，或在 `ALLOWED` 里点名（点名要交代为什么不需要前缀）。
 * - 修完之后组件里一条字面量绝对 href 都不剩，所以「扫到了多少条」不能当门禁——
 *   改成两件事：扫描文件数有地板（巡检自己缩水就红），外加一条**正向对照**，
 *   拿一个已知违规的片段喂给同一个判据，要求它必须报出来。
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { LOCALES } from "./i18n";

/** 不需要语种前缀的站内绝对路径：每一条都得交代为什么 */
const ALLOWED = [
  "/api/", // 接口路由本来就住在根级
  "/knowledge-assets/", // 知识库图片由 prebuild 脚本落到 public/
];

/** 返回这段源码里所有「没有语种前缀的字面量绝对 href」 */
export function findUnprefixedHrefs(src: string): string[] {
  const bad: string[] = [];
  for (const match of src.matchAll(/href=\{?\s*(?:"([^"]*)"|`([^`]*)`)/g)) {
    const raw = match[1] ?? match[2] ?? "";
    if (!raw.startsWith("/")) continue;
    const first = raw.split("/")[1] ?? "";
    if (!first || first.startsWith("${")) continue; // /${locale}/… 是带前缀的正常写法
    const ok =
      (LOCALES as readonly string[]).includes(first) || ALLOWED.some((a) => raw.startsWith(a));
    if (!ok) bad.push(raw);
  }
  return bad;
}

/** 只扫渲染进 DOM 的组件源码；测试与夹具里的 `/zh/...` 是断言用的字符串 */
function componentFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...componentFiles(full));
    else if (entry.endsWith(".tsx") && !entry.includes(".test.")) out.push(full);
  }
  return out;
}

const files = componentFiles(path.join(process.cwd(), "src")).sort();

describe("站内链接带着它的语种", () => {
  it("扫描范围没有缩水（地板取自当前实测，减少即红）", () => {
    expect(files.length, "扫到的组件数低于地板，说明巡检自己看不见了").toBeGreaterThanOrEqual(117);
  });

  it("判据本身还活着：喂已知违规的片段必须报出来，合法的不许报", () => {
    expect(findUnprefixedHrefs('<Link href="/replay" />'), "字面量缺前缀").toEqual(["/replay"]);
    expect(findUnprefixedHrefs('<a href={`/search`}>x</a>'), "模板串同样要查").toEqual(["/search"]);
    // 对照三例：写死语种、用变量带语种、门禁里点名过的接口路径——都不该报，
    // 否则这条判据只是无脑红，谁都能用「把它关掉」来满足它。
    expect(findUnprefixedHrefs('<a href={`/en/search`}>x</a>')).toEqual([]);
    expect(findUnprefixedHrefs('<a href={`/${locale}/search`}>x</a>')).toEqual([]);
    expect(findUnprefixedHrefs('<Link href="/api/ai/chat" />')).toEqual([]);
  });

  it("组件里不存在没带语种前缀的字面量链接（缺前缀会被代理换成 cookie 里的语种）", () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const href of findUnprefixedHrefs(readFileSync(file, "utf8"))) {
        offenders.push(`${path.relative(process.cwd(), file)} → href="${href}"`);
      }
    }
    expect(offenders, `这些链接的第一段不是语种：\n${offenders.join("\n")}`).toEqual([]);
  });
});
