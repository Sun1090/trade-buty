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
      if (total <= 0 || window.scrollY / total > 0.65) {
        markRead(chapterNum, docSlug);
        fired.current = true;
        window.removeEventListener("scroll", onScroll);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [chapterNum, docSlug]);

  return null;
}
