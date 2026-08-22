"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 全局快捷键：⌘K / Ctrl+K 跳转搜索页 */
export function SearchHotkey({ locale }: { locale: string }) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push(`/${locale}/search`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locale, router]);

  return null;
}
