"use client";

import { useState } from "react";

/** 课文朗读（speechSynthesis），带语速切换 */
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
  const [rate, setRate] = useState(0.9);

  function toggle() {
    if (speaking) {
      speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const clean = text
      .replace(/^---[\s\S]*?---\n?/, "")
      .replace(/[#*`~\[\]()>|]/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .slice(0, 3000);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = locale === "zh" ? "zh-CN" : "en-US";
    utterance.rate = rate;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  function cycleRate() {
    const rates = [0.8, 0.9, 1.0, 1.2];
    const idx = rates.indexOf(rate);
    setRate(rates[(idx + 1) % rates.length]);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggle}
        className="text-xs text-faint hover:text-accent transition px-2 py-1 rounded-lg border border-[var(--border)] hover:border-accent/40"
        aria-label={speaking ? playingLabel : label}
      >
        {speaking ? "🔊 " + playingLabel : "🔈 " + label}
      </button>
      <button
        onClick={cycleRate}
        className="text-[10px] text-faint hover:text-accent transition px-1.5 py-1 rounded-lg border border-[var(--border)]"
        title="语速"
      >
        {rate}×
      </button>
    </div>
  );
}