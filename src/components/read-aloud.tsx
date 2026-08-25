"use client";

import { useState } from "react";

/** 课文朗读（speechSynthesis） */
export function ReadAloud({
  text,
  label,
  playingLabel,
  locale,
}: {
  text: string;
  label: string;
  playingLabel: string;
  locale: string;
}) {
  const [speaking, setSpeaking] = useState(false);

  function toggle() {
    if (speaking) {
      speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    // 清理可见文本（去掉 frontmatter, markdown 标记）
    const clean = text
      .replace(/^---[\s\S]*?---\n?/, "")
      .replace(/[#*`~\[\]()>|]/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .slice(0, 3000);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = locale === "zh" ? "zh-CN" : "en-US";
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  return (
    <button
      onClick={toggle}
      className="text-xs text-faint hover:text-accent transition px-2 py-1 rounded-lg border border-[var(--border)] hover:border-accent/40"
      aria-label={speaking ? playingLabel : label}
    >
      {speaking ? "🔊 " + playingLabel : "🔈 " + label}
    </button>
  );
}