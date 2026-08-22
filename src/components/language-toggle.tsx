"use client";

import { usePathname, useRouter } from "next/navigation";

export function LanguageToggle() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  function toggle() {
    const segs = pathname.split("/");
    const current = segs[1];
    const next = current === "en" ? "zh" : "en";
    if (current === "zh" || current === "en") {
      segs[1] = next;
      router.push(segs.join("/") || `/${next}`);
    } else {
      router.push(`/${next}${pathname}`);
    }
    document.cookie = `tb-lang=${next};path=/;max-age=31536000;samesite=lax`;
  }

  return (
    <button
      onClick={toggle}
      aria-label="切换语言 / Switch language"
      title="中文 / EN"
      className="px-2 py-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition text-xs font-mono"
    >
      {pathname.startsWith("/en") ? "中" : "EN"}
    </button>
  );
}
