"use client";

import { useState } from "react";

/**
 * 每条 utterance 的字数上限（R16.50）。这个数原先管的是**整篇课文**：182 篇中文课里
 * 173 篇超过 3000 字，中位数 6,646 字，于是按钮写着「朗读」而后半篇从没进过引擎，
 * 念完前 3000 字还会像整篇读完那样把按钮放回原样。现在按段切成多条排队念，
 * 上限只约束每条的长度。
 */
export const READ_ALOUD_CHUNK_CHARS = 3000;

/** 段落优先装满每条；单段本身超限才硬切（表格那种没有空行的长段就是这么撞上的） */
function splitForSpeech(text: string, limit: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const para of text.split(/\n{2,}/)) {
    if (!para.trim()) continue;
    if (current && current.length + para.length + 2 > limit) {
      chunks.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
    while (current.length > limit) {
      chunks.push(current.slice(0, limit));
      current = current.slice(limit);
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

/** 课文朗读（speechSynthesis），带语速切换 */
export function ReadAloud({
  text,
  label,
  playingLabel,
  rateLabel,
  locale,
}: {
  text: string;
  label: string;
  playingLabel: string;
  rateLabel: string;
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
      .replace(/\n{3,}/g, "\n\n");
    const chunks = splitForSpeech(clean, READ_ALOUD_CHUNK_CHARS);
    if (chunks.length === 0) return;
    const lastIndex = chunks.length - 1;
    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = locale === "zh" ? "zh-CN" : "en-US";
      utterance.rate = rate;
      // 只有队尾那条念完才算念完：中间每条都回调一次，按钮会被提前放回待命态
      if (index === lastIndex) utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => {
        speechSynthesis.cancel();
        setSpeaking(false);
      };
      speechSynthesis.speak(utterance);
    });
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
        title={rateLabel}
      >
        {rate}×
      </button>
    </div>
  );
}