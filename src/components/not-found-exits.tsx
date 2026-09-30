"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { localeFromPathname } from "@/lib/locale-from-path";

interface Props {
  labels: { search: string; home: string; path: string };
}

/**
 * 根级 404 的三个出口（R16.41 最小伤害版）：
 * 根级边界没有 locale 上下文，SSR 只能按 DEFAULT_LOCALE 出一版——所以第一渲染
 * 必须与静态 HTML 一致（仍是 /en），挂载后读 `usePathname()` 的前缀把 href 修正
 * 成 URL 自己的语言。两段式不是装饰：直接在首次渲染里读 pathname 会让静态边界
 * 的 href 属性水合错位。正文与推荐位仍是英文（那份取舍登记在 R16.41 / R16.159），
 * 本组件只修「把中文用户从自己的 locale 里送走」这半个伤害。
 */
export function NotFoundExits({ labels }: Props) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const pathname = usePathname();
  useEffect(() => {
    const fromUrl = localeFromPathname(pathname);
    if (fromUrl !== locale) setLocale(fromUrl);
  }, [pathname, locale]);

  const exits = [
    { href: `/${locale}/search`, label: `🔍 ${labels.search}`, primary: true },
    { href: `/${locale}`, label: labels.home, primary: false },
    { href: `/${locale}/path`, label: labels.path, primary: false },
  ];

  return (
    <>
      {exits.map(({ href, label, primary }) => (
        <Link
          key={href}
          href={href}
          className={
            primary
              ? "rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-7 py-3 transition"
              : "rounded-full border border-border-strong px-7 py-3 font-medium hover:border-accent/60 transition"
          }
        >
          {label}
        </Link>
      ))}
    </>
  );
}
