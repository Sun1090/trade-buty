import { NextRequest, NextResponse } from "next/server";

const LOCALES = ["zh", "en"];
const DEFAULT_LOCALE = "en";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const first = pathname.split("/")[1];
  if (LOCALES.includes(first)) return;

  // 纯默认 en：用户用导航栏切换语言后由 cookie 记住；
  // 不再按 accept-language 自动猜，避免中文系统浏览器永远跳 zh
  const cookie = req.cookies.get("tb-lang")?.value;
  const locale = cookie && LOCALES.includes(cookie) ? cookie : DEFAULT_LOCALE;

  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next|api|favicon.ico|knowledge-assets|sitemap.xml|robots.txt|search-index.json|.*\\.\\w+$).*)",
  ],
};
