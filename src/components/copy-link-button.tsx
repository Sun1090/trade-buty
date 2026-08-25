"use client";

import { useState } from "react";

/** 复制当前页链接按钮 */
export function CopyLinkButton({
  label,
  copiedLabel,
}: {
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={copy}
      className="text-xs text-faint hover:text-accent transition px-2 py-1 rounded-lg border border-[var(--border)] hover:border-accent/40"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}