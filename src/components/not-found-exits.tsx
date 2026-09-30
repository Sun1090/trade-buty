"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { localeFromPathname } from "@/lib/locale-from-path";

interface Props {
  labels: { search: string; home: string; path: string };
}

/** pathname 在 404 页生命周期内不变，订阅只需占位；语言变化由重渲染时的快照带出 */
const subscribeNoop = () => () => {};

/**
 * 根级 404 的三个出口（R16.41 最小伤害版）：
 * 根级边界没有 locale 上下文，SSR 只能按 DEFAULT_LOCALE 出一版——useSyncExternalStore
 * 的 server 快照保证首渲染与静态 HTML 一致，水合后 React 自己换算到客户端快照
 * （URL 前缀认出的语言），既无水合错位也不需要 effect 里 setState。
 * 正文与推荐位仍是英文（那份取舍登记在 R16.41 / R16.159），本组件只修
 * 「把中文用户从自己的 locale 里送走」这半个伤害。
 */
export function NotFoundExits({ labels }: Props) {
  const pathname = usePathname();
  const locale = useSyncExternalStore<Locale>(
    subscribeNoop,
    () => localeFromPathname(pathname),
    () => DEFAULT_LOCALE,
  );

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
