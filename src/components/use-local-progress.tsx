"use client";

import { useEffect, useState } from "react";
import { readProgress, type ProgressMap } from "@/lib/progress";

/** 客户端挂载后读取本地进度，避免 SSR 水合不一致 */
export function useLocalProgress(): ProgressMap | null {
  const [progress, setProgress] = useState<ProgressMap | null>(null);

  useEffect(() => {
    // 从 localStorage 同步一次性快照，非派生状态场景
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(readProgress());
    const onChange = () => setProgress(readProgress());
    window.addEventListener("tb-progress", onChange);
    return () => window.removeEventListener("tb-progress", onChange);
  }, []);

  return progress;
}
