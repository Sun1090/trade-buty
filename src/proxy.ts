import { NextRequest, NextResponse } from "next/server";

const LOCALES = ["zh", "en"];
const DEFAULT_LOCALE = "en";

/**
 * 根级、**不带**语言前缀的真实路由前缀。
 *
 * `/[locale]` 只承担应用主体；分享落地页 `/share/{kind}/{payload}` 的 locale 编码在
 * 载荷里（见 `src/lib/share-decode.ts`），生成的分享链接本来就不含语言前缀
 * （`src/components/quiz.tsx` 等直接拼 `origin + /share/...`）。所以这里必须原样放行，
 * 否则每次分享都会被代理改写成 `/en/share/...` 而 404。
 */
export const LOCALE_FREE_PREFIXES = ["share"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const first = pathname.split("/")[1];
  if (LOCALES.includes(first)) return;
  if (LOCALE_FREE_PREFIXES.includes(first)) return;

  // 纯默认 en：用户用导航栏切换语言后由 cookie 记住；
  // 不再按 accept-language 自动猜，避免中文系统浏览器永远跳 zh
  const cookie = req.cookies.get("tb-lang")?.value;
  const locale = cookie && LOCALES.includes(cookie) ? cookie : DEFAULT_LOCALE;

  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

/**
 * 只有「真实存在的静态表面」才绕过语言代理。
 *
 * 以前这里用 `.*\.\w+$` 兜住所有带扩展名的路径，外加写得很宽的无扩展名白名单。
 * 副作用是**不存在**的类文件路径（`/foo.png`、`/sitemap.json`、`/icon.svg`）和
 * 宽前缀（`/apple-icon`、`/knowledge-assets`、`/api`）也会绕过代理，直接落进根级
 * 动态段 `/[locale]`。App Router 会把它们当成非法 locale，在请求时按需渲染出一张
 * HTTP 200 的首页外壳（`x-matched-path: /[locale]`）——对搜索引擎是一批软 404。
 *
 * 现在改成显式列举，且每条都锚定到路径边界（`$` 或 `/`），不再有前缀误放行：
 * - `public/` 下的文件：`knowledge-assets/`、`search-index.json`、`sw.js`、`offline.html`；
 * - app 根级 file-route：`/favicon.ico`、`/icon`、`/manifest.webmanifest`、
 *   `/robots.txt`、`/sitemap.xml`；
 * - 根级真实页面前缀：`/share/`（见 `LOCALE_FREE_PREFIXES`）；
 * - 内部与接口前缀：`/_next/`、`/api/`。
 *
 * 其余路径一律补 `/{locale}` 前缀，由路由层正常返回 404。新增静态文件或根级路由时
 * `src/proxy.test.ts` 的守卫用例会失败，提示把它加进这里。
 */
export const config = {
  matcher: [
    "/((?!_next/|api/|share/|favicon\\.ico$|icon$|manifest\\.webmanifest$|robots\\.txt$|sitemap\\.xml$|search-index\\.json$|sw\\.js$|offline\\.html$|knowledge-assets/).*)",
  ],
};
