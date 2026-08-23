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
  const [img, setImg] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    const root = document.querySelector(containerSelector);
    if (!root) return;
    const onClick = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "IMG") {
        e.preventDefault();
        setImg({ src: (t as HTMLImageElement).src, alt: (t as HTMLImageElement).alt });
      }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [containerSelector]);

  useEffect(() => {
    if (!img) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImg(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [img]);

  if (!img) return null;

  return (
    <div
      onClick={() => setImg(null)}
      className="fixed inset-0 z-[70] bg-black/85 flex flex-col items-center justify-center p-4 cursor-zoom-out"
      role="dialog"
      aria-modal="true"
      aria-label={closeLabel}
    >
      <button
        onClick={() => setImg(null)}
        aria-label={closeLabel}
        className="absolute right-4 top-4 h-10 w-10 rounded-full border border-white/30 text-white/80 hover:text-white hover:border-white text-lg"
      >
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.src}
        alt={img.alt}
        className="max-h-[80vh] max-w-full object-contain rounded-lg bg-white p-2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {img.alt && (
        <p className="mt-4 max-w-lg text-center text-sm text-white/60 leading-relaxed">
          {img.alt}
        </p>
      )}
    </div>
  );
}
