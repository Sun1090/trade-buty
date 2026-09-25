"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { SuggestibleItem } from "@/lib/url-suggest";
import { parseKnowledgePath, suggestFromPath } from "@/lib/url-suggest";

interface Props {
  /** 服务端传入的语料（章节 + doc），客户端按距离筛最近 */
  corpus: SuggestibleItem[];
  /** 章节标题 */
  heading: string;
  /** 章节副标题 */
  subheading: string;
}

/**
 * R8.11 根级 404 推荐位：
 * - pathname 在知识库路径下、且按地址真的排得出推荐：显示那几条
 * - 其余一律不渲染（章节段全是空白也算「排不出」，由下方「从这几篇开始」兜底）
 *   小标题说的是「按你访问的地址猜的」，所以一旦列表与地址无关，这一栏就必须消失——
 *   旧写法在这里回退过 `pickFallback(corpus, 3)`，那是语料的前三条，跟地址没有关系。
 * - `usePathname()` 首次渲染就读，没有「挂载后再读」的二段式；404 边界的静态 HTML
 *   里这一整块是空的，客户端才填出 3 条（实测 /zh/knowledge/getting-started/a/b，
 *   控制台无 hydration 报错）
 */
export function NotFoundSuggestions({ corpus, heading, subheading }: Props) {
  const pathname = usePathname() ?? "";
  const parsed = useMemo(() => parseKnowledgePath(pathname), [pathname]);
  const isKb = !!parsed?.chapter;

  // 必须在 early return 之前调用所有 hooks（hooks 顺序规则）
  const suggestions: SuggestibleItem[] = useMemo(() => {
    if (!isKb) return [];
    return suggestFromPath(pathname, corpus, 3);
  }, [pathname, corpus, isKb]);

  if (!isKb || suggestions.length === 0) return null;

  return (
    <div className="mt-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent mb-2">
        {heading}
      </p>
      <p className="text-sm text-muted mb-6">{subheading}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="not-found-suggestions">
        {suggestions.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-left hover:border-[var(--accent)]/50 transition"
          >
            <p className="font-semibold text-sm group-hover:text-accent transition-colors line-clamp-1">
              {s.title}
            </p>
            <p className="mt-1 text-xs text-faint font-mono line-clamp-1">{s.slug}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
