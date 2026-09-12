"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Keep the document language in sync during client-side locale navigation. */
export function LocaleHtmlLang() {
  const pathname = usePathname();

  useEffect(() => {
    const locale = pathname.split("/")[1];
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
  }, [pathname]);

  return null;
}
