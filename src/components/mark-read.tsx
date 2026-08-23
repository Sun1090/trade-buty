"use client";

import { useEffect, useRef } from "react";
import { markRead } from "@/lib/progress";

export function MarkRead({
  chapterNum,
  docSlug,
}: {
  chapterNum: string;
  docSlug: string;
}) {
  const fired = useRef(false);

  useEffect(() => {
    fired.current = false;
    function onScroll() {
      if (fired.current) return;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      // 内容不足一屏（total<=0）视为已读
      if (total <= 0 || window.scrollY / total > 0.5) {
        markRead(chapterNum, docSlug);
        fired.current = true;
        window.removeEventListener("scroll", onScroll);
      }
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [chapterNum, docSlug]);

  return null;
}
