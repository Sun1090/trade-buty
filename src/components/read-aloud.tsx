"use client";

import { useState } from "react";
import { dropInlineTags } from "@/lib/md-utils";

/**
 * 每条 utterance 的字数上限（R16.50）。这个数原先管的是**整篇课文**：182 篇中文课里
 * 173 篇超过 3000 字，中位数 6,646 字，于是按钮写着「朗读」而后半篇从没进过引擎，
 * 念完前 3000 字还会像整篇读完那样把按钮放回原样。现在按段切成多条排队念，
 * 上限只约束每条的长度。
 */
export const READ_ALOUD_CHUNK_CHARS = 3000;

/**
 * 把课文压成念得出口的纯文本。喂进来的必须是**正文渲染用的那一份字符串**
 * （prepareForRender 之后），这样朗读与屏幕上的课文同源；这里只负责把标记去掉。
 *
 * 旧实现是一串字符黑名单（`[#*`~\[\]()>|]`），它删得掉尖括号却删不掉标记的**内容**：
 * `<mark>杠杆</mark>` 念出来是「mark 杠杆 mark」，`[骗局识别](../pitfalls/scam-detection.md)`
 * 念出来是「骗局识别点点 pitfalls 斜杠 scam-detection 点 md」，表格分隔行
 * `|:---|:---|` 念成一串冒号。按下面这四条判据扫整棵树，旧实现在有 368 篇留收尾标签、
 * 368 篇留标签名、422 篇留一整行横线；现在要求一处都不留。
 */
export function speechText(md: string): string {
  const withoutMedia = md
    .replace(/^---[\s\S]*?---\n?/, "")
    // 图片只留替代文字，链接只留锚文——URL 不是念给人听的
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  return (
    dropInlineTags(withoutMedia)
      // 表格的分隔行整行丢弃，剩下的单元格用空格断句
      .replace(/^[ \t]*\|?[ \t]*:?-{2,}[ \t|:-]*$\n/gm, "")
      // 块标记：标题井号、引用竖线、列表符号
      .replace(/^#{1,6}[ \t]+/gm, "")
      .replace(/^>[ \t]?/gm, "")
      .replace(/^[ \t]*[-*+][ \t]+/gm, "")
      // 强调与行内代码的记号
      .replace(/[*_~`|]/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** 段落优先装满每条；单段本身超限才硬切（表格那种没有空行的长段就是这么撞上的） */function splitForSpeech(text: string, limit: number): string[] {
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
    const chunks = splitForSpeech(speechText(text), READ_ALOUD_CHUNK_CHARS);
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