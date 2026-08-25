"use client";

import { useEffect, useState } from "react";
import { readBookmarks } from "@/lib/bookmarks";

/** 导航栏收藏数徽标 */
export function BookmarkCount({ label }: { label: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    function update() {
      setCount(Object.keys(readBookmarks()).length);
    }
    update();
    window.addEventListener("tb-bookmarks", update);
    return () => window.removeEventListener("tb-bookmarks", update);
  }, []);

  if (count === 0) return null;

  return (
    <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-accent-dim text-accent text-[10px] font-semibold" aria-label={`${count} ${label}`}>
      {count}
    </span>
  );
}