import { NextRequest, NextResponse } from "next/server";

const LOCALES = ["zh", "en"];
const DEFAULT_LOCALE = "en";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const first = pathname.split("/")[1];
  if (LOCALES.includes(first)) return;

  // 优先 cookie，其次 accept-language，默认 en
  const cookie = req.cookies.get("tb-lang")?.value;
  let locale = DEFAULT_LOCALE;
  if (cookie && LOCALES.includes(cookie)) {
    locale = cookie;
  } else {
    const accept = req.headers.get("accept-language") ?? "";
    locale = accept.toLowerCase().startsWith("zh") ? "zh" : DEFAULT_LOCALE;
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next|api|favicon.ico|knowledge-assets|sitemap.xml|robots.txt|search-index.json|.*\\.\\w+$).*)",
  ],
};
