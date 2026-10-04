"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DEFAULT_LOCALE, getDict, type Locale } from "@/lib/i18n";
import { localeFromPathname } from "@/lib/locale-from-path";
import { reportRouteError } from "@/lib/error-report";

/** pathname 在错误边界生命周期内基本不变，订阅只需占位（与 not-found-exits 同款） */
const subscribeNoop = () => () => {};

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportRouteError(error, "route-error");
  }, [error]);

  // R16.41 最小伤害版：SSR 按 DEFAULT_LOCALE 出一版，水合后 Home 的 href 跟随
  // URL 前缀（useSyncExternalStore 的 server 快照保证首渲染一致，不需要 effect 里
  // setState——react-hooks/set-state-in-effect 禁的就是它）
  const pathname = usePathname();
  const t = getDict(DEFAULT_LOCALE);
  const locale = useSyncExternalStore<Locale>(
    subscribeNoop,
    () => localeFromPathname(pathname),
    () => DEFAULT_LOCALE,
  );

  return (
    <main className="relative mx-auto max-w-3xl px-5 py-28 text-center overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, rgba(248,113,113,.08), transparent 70%)",
        }}
        aria-hidden
      />
      <p className="relative font-mono text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-[var(--down)] to-accent">:(</p>
      {/* R16.295：同样取字典。这一页是「use client」，但 getDict 是纯函数、
          SSR 期就能算出与客户端相同的结果，不会有水合错位 */}
      <h1 className="relative mt-6 text-2xl font-bold">
        {t.notFound.errorPageTitle}
        <span className="block mt-2 text-sm font-normal text-muted">
          {t.notFound.errorPageTagline}
        </span>
      </h1>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-faint">ref: {error.digest}</p>
      )}
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-7 py-3 transition"
        >
          {t.notFound.errorPageRetry} ↻
        </button>
        <Link
          href={`/${locale}`}
          className="rounded-full border border-border-strong px-7 py-3 font-medium hover:border-accent/60 transition"
        >
          {t.notFound.errorPageHome}
        </Link>
      </div>
    </main>
  );
}
