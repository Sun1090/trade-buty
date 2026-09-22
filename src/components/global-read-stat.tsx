"use client";

import { useLocalProgress } from "@/components/use-local-progress";
import { useAuth } from "@/components/auth-provider";
import { readSummary } from "@/lib/learn-stats";

export function GlobalReadStat({
  chapters,
  textTpl,
  keepGoing,
  syncedLabel,
}: {
  chapters: { slug: string; docCount: number }[];
  textTpl: string;
  keepGoing: string;
  syncedLabel: string;
}) {
  const progress = useLocalProgress();
  const user = useAuth();
  // 与同页的「总进度」卡（PathGlobalProgress → readSummary）共用口径：
  // 此前这里把 localStorage 里所有章节键的值全加起来，云端合并回来的旧章节键
  // 会被算进来，于是同一页出现「你已完成 14 / 182 篇」与「2/182」两个数。
  const { readDocs, totalDocs } = readSummary(progress ?? {}, chapters);
  const read = progress ? readDocs : null;

  if (read === null || read === 0) return null;

  return (
    <p className="mt-6 text-sm text-accent">
      {textTpl.replace("{r}", String(read)).replace("{t}", String(totalDocs))} ·{" "}
      <span className="text-muted">{keepGoing}</span>
      {user && (
        <span className="ml-2 text-xs text-faint" title={syncedLabel}>
          ☁
        </span>
      )}
    </p>
  );
}
