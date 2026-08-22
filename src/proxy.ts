import { NextRequest, NextResponse } from "next/server";

const LOCALES = ["zh", "en"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const first = pathname.split("/")[1];
  if (LOCALES.includes(first)) return;

  const cookie = req.cookies.get("tb-lang")?.value;
  const accept = req.headers.get("accept-language") ?? "";
  const locale =
    cookie === "en" || (cookie !== "zh" && !accept.toLowerCase().startsWith("zh"))
      ? "en"
      : "zh";

  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next|api|favicon.ico|knowledge-assets|sitemap.xml|robots.txt|search-index.json|.*\\.\\w+$).*)",
  ],
};
