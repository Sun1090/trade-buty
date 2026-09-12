"use client";

import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "./use-modal-focus";

/** 知识库图片点击放大（灯箱），ESC 或点击遮罩关闭 */
export function ImageLightbox({
  containerSelector,
  closeLabel,
}: {
  containerSelector: string;
  closeLabel: string;
}) {
  const [img, setImg] = useState<{ src: string; alt: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useModalFocus({
    active: img !== null,
    containerRef: dialogRef,
    onClose: () => setImg(null),
  });

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(containerSelector);
    if (!root) return;
    const openImage = (target: EventTarget | null) => {
      if (!(target instanceof HTMLImageElement)) return false;
      setImg({ src: target.src, alt: target.alt });
      return true;
    };
    const onClick = (e: Event) => {
      if (openImage(e.target)) {
        e.preventDefault();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const target = e.target;
      if (!(target instanceof HTMLImageElement) || target.getAttribute("role") !== "button") {
        return;
      }
      if (openImage(target)) e.preventDefault();
    };
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeyDown);
    };
  }, [containerSelector]);

  useEffect(() => {
    if (!img) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [img]);

  if (!img) return null;

  return (
    <div
      ref={dialogRef}
      onClick={() => setImg(null)}
      className="fixed inset-0 z-[70] bg-black/85 flex flex-col items-center justify-center p-4 cursor-zoom-out"
      role="dialog"
      aria-modal="true"
      aria-label={closeLabel}
      tabIndex={-1}
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
