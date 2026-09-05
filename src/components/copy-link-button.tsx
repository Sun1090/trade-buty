"use client";

import { useState } from "react";

interface Props {
  /** 完整可分享 URL（含 origin）。不传则复制当前页面 URL。 */
  url?: string;
  /** 按钮文案（i18n） */
  label: string;
  /** 复制成功后短提示（i18n） */
  copiedLabel: string;
  /** 测试 hook */
  testId: string;
  /** 可选样式覆盖 */
  className?: string;
}

/**
 * R8.4 分享链接复制按钮：
 * - 用 navigator.clipboard.writeText（不支持时降级到 document.execCommand）
 * - 成功后切换文案 1.5s 给视觉反馈
 * - 失败时也反馈给用户（不可静默吞错——分享是用户主动操作）
 */
export function CopyLinkButton({ url, label, copiedLabel, testId, className }: Props) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setFailed(false);
    const target = url ?? (typeof window !== "undefined" ? window.location.href : "");
    if (!target) {
      setFailed(true);
      setTimeout(() => setFailed(false), 2000);
      return;
    }
    let ok = false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(target);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      // 降级路径：构造临时 textarea + execCommand
      try {
        if (typeof document !== "undefined") {
          const ta = document.createElement("textarea");
          ta.value = target;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand("copy");
          ta.remove();
        }
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      setFailed(true);
      setTimeout(() => setFailed(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid={testId}
      className={
        className ??
        "rounded-full border border-[var(--accent)]/40 bg-[var(--surface)] hover:border-accent/60 text-accent font-medium px-5 py-2 text-sm transition"
      }
    >
      {failed ? "⚠️ Copy failed" : copied ? `✓ ${copiedLabel}` : `🔗 ${label}`}
    </button>
  );
}
