"use client";

import { useEffect, useState } from "react";
import { getReadingTime, formatDuration } from "@/lib/reading-time";

export function ReadingTimeDisplay({
  chapter,
  doc,
  label,
}: {
  chapter: string;
  doc: string;
  label: string;
}) {
  const [time, setTime] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTime(getReadingTime(chapter, doc));
    // 页面停留时每 5 秒刷新显示
    const t = setInterval(() => setTime(getReadingTime(chapter, doc)), 5000);
    return () => clearInterval(t);
  }, [chapter, doc]);

  if (time === 0) return null;

  return (
    <span className="text-xs text-faint font-mono">
      ⏱ {label} {formatDuration(time)}
    </span>
  );
}
