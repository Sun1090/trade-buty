"use client";

import { useLocalProgress } from "@/components/use-local-progress";
import { useAuth } from "@/components/auth-provider";

export function GlobalReadStat({
  totalDocs,
  textTpl,
  keepGoing,
  syncedLabel,
}: {
  totalDocs: number;
  textTpl: string;
  keepGoing: string;
  syncedLabel: string;
}) {
  const progress = useLocalProgress();
  const user = useAuth();
  const read = progress
    ? Object.values(progress).reduce((s, list) => s + list.length, 0)
    : null;

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
