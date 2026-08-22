"use client";

import { useEffect } from "react";

/**
 * 代码块复制按钮（事件委托挂在容器上，无需改造 Markdown 渲染树）
 */
export function CodeCopy({
  containerSelector,
  copiedLabel,
  copyLabel,
}: {
  containerSelector: string;
  copiedLabel: string;
  copyLabel: string;
}) {
  useEffect(() => {
    const root = document.querySelector(containerSelector);
    if (!root) return;

    const buttons = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

    function attach(pre: HTMLElement) {
      if (pre.dataset.copyAttached) return;
      pre.dataset.copyAttached = "1";
      pre.style.position = "relative";
      const btn = document.createElement("button");
      btn.textContent = copyLabel;
      btn.className =
        "absolute right-2 top-2 text-[11px] px-2 py-1 rounded-md border border-white/15 text-white/60 hover:text-white hover:border-white/40 transition opacity-0 group-hover:opacity-100 focus:opacity-100";
      pre.addEventListener("mouseenter", () => (btn.style.opacity = "1"));
      pre.addEventListener("mouseleave", () => (btn.style.opacity = "0"));
      btn.addEventListener("click", async () => {
        const code = pre.querySelector("code")?.textContent ?? "";
        try {
          await navigator.clipboard.writeText(code);
          btn.textContent = copiedLabel;
        } catch {
          btn.textContent = "✕";
        }
        setTimeout(() => (btn.textContent = copyLabel), 1500);
      });
      pre.appendChild(btn);
      buttons.set(pre, undefined as never);
    }

    // MutationObserver 覆盖动态内容
    const scan = () => root.querySelectorAll("pre").forEach(attach);
    scan();
    const ob = new MutationObserver(scan);
    ob.observe(root, { childList: true, subtree: true });
    return () => {
      ob.disconnect();
      buttons.forEach((t) => t && clearTimeout(t));
    };
  }, [containerSelector, copiedLabel, copyLabel]);

  return null;
}
