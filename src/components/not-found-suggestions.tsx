"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { SuggestibleItem } from "@/lib/url-suggest";
import { parseKnowledgePath, pickFallback, suggestFromPath } from "@/lib/url-suggest";

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
 * - pathname 在知识库路径下：显示 URL 推荐的 3 条最近
 * - pathname 不在知识库路径下：不渲染（由 Popular starters 兜底）
 * - 服务端 SSR 不读 pathname（避免 hydration mismatch），挂载后再读
 */
export function NotFoundSuggestions({ corpus, heading, subheading }: Props) {
  const pathname = usePathname() ?? "";
  const parsed = useMemo(() => parseKnowledgePath(pathname), [pathname]);
  const isKb = !!parsed && !!parsed.chapter;

  // 必须在 early return 之前调用所有 hooks（hooks 顺序规则）
  const suggestions: SuggestibleItem[] = useMemo(() => {
    if (!isKb) return [];
    const out = suggestFromPath(pathname, corpus, 3);
    if (out.length > 0) return out;
    return pickFallback(corpus, 3);
  }, [pathname, corpus, isKb]);

  if (!isKb) return null;

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
