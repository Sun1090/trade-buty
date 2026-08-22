"use client";

import { useLocalProgress } from "@/components/use-local-progress";

/**
 * 学习路线页：单个章节的已读进度标记。
 * 不做硬性锁定——所有内容始终可访问，只显示视觉进度。
 */
export function PathProgress({
  chapterSlug,
  docCount,
}: {
  chapterSlug: string;
  docCount: number;
}) {
  const progress = useLocalProgress();
  const read = progress?.[chapterSlug]?.length ?? 0;

  if (read === 0) return null;

  const done = read >= docCount;
  const pct = Math.round((read / docCount) * 100);

  return (
    <span className="flex items-center gap-2" aria-label={`${read}/${docCount}`}>
      {done && (
        <span
          className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[#06281c] text-[11px]"
          aria-hidden
        >
          ✓
        </span>
      )}
      <span className="font-mono text-xs text-accent">
        {read}/{docCount}
      </span>
      {!done && (
        <span className="hidden sm:flex h-1 w-12 rounded-full bg-white/10 overflow-hidden">
          <span
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </span>
      )}
    </span>
  );
}
