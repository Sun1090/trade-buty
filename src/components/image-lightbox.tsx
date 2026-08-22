"use client";

import { useEffect, useState } from "react";

/** 知识库图片点击放大（灯箱），ESC 或点击遮罩关闭 */
export function ImageLightbox({
  containerSelector,
  closeLabel,
}: {
  containerSelector: string;
  closeLabel: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const root = document.querySelector(containerSelector);
    if (!root) return;
    const onClick = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "IMG") {
        e.preventDefault();
        setSrc((t as HTMLImageElement).src);
      }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [containerSelector]);

  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSrc(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [src]);

  if (!src) return null;

  return (
    <div
      onClick={() => setSrc(null)}
      className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-4 cursor-zoom-out"
      role="dialog"
      aria-modal="true"
      aria-label={closeLabel}
    >
      <button
        onClick={() => setSrc(null)}
        aria-label={closeLabel}
        className="absolute right-4 top-4 h-10 w-10 rounded-full border border-white/30 text-white/80 hover:text-white hover:border-white text-lg"
      >
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="max-h-[90vh] max-w-full object-contain rounded-lg bg-white p-2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
