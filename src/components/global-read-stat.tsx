"use client";

import { useLocalProgress } from "@/components/use-local-progress";

export function GlobalReadStat({
  totalDocs,
  textTpl,
  keepGoing,
}: {
  totalDocs: number;
  textTpl: string;
  keepGoing: string;
}) {
  const progress = useLocalProgress();
  const read = progress
    ? Object.values(progress).reduce((s, list) => s + list.length, 0)
    : null;

  if (read === null || read === 0) return null;

  return (
    <p className="mt-6 text-sm text-accent">
      {textTpl.replace("{r}", String(read)).replace("{t}", String(totalDocs))} ·{" "}
      <span className="text-muted">{keepGoing}</span>
    </p>
  );
}
