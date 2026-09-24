"use client";

import { useSyncExternalStore } from "react";
import { useLocalProgress } from "@/components/use-local-progress";
import { useAuth } from "@/components/auth-provider";
import { readSummary } from "@/lib/learn-stats";
import { getUnarchivedWriteCount, subscribeQueueLength } from "@/lib/sync-queue-store";

/**
 * 首页那句已读旁边的 ☁。
 *
 * `syncedLabel` 说的是「已云端存档」——完成时。断网时的读会先进离线写队列（R9.5），
 * 它们已经计入旁边那个数字，却一条都还没到云上：这时挂 ☁ 等于对着一份只活在
 * localStorage 里的记录承诺「换设备不丢」。所以 ☁ 的条件不是「登录了」，而是
 * 「登录了且没有待传的写」。队列清空后 persist() 会再发一次事件，标记自己会回来。
 *
 * 「待传的写」不等于「队列长度」：队列超过 `MAX_QUEUE` 时 `trimQueue` 丢的是**最旧的
 * 未上传条目**（R16.139），丢完剩下的照样会 flush 成 0——那时队列是空的，丢掉的却没走。
 * 判据因此取 `getUnarchivedWriteCount()`（队列 + 被挤掉的条数），两个都为零才说「已存档」。
 */
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
  const unarchivedWrites = useSyncExternalStore(subscribeQueueLength, getUnarchivedWriteCount, () => 0);
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
      {user && unarchivedWrites === 0 && (
        <span className="ml-2 text-xs text-faint" title={syncedLabel}>
          ☁
        </span>
      )}
    </p>
  );
}
