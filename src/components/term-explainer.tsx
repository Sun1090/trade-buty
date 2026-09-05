"use client";

import { useEffect, useRef, useState } from "react";
import { isAiGloballyDisabled } from "@/lib/ai-toggle";
import { trackAiClick } from "@/lib/analytics";

export interface TermExplainerDict {
  hint: string;
  loading: string;
  error: string;
  disclaimer: string;
}

/** 纯逻辑：判断选区是否值得解释（长度 2–30、在文章内）——导出便于单测 */
export function shouldExplain(
  text: string,
  node: Node | null,
  isInsideArticle: (n: Node) => boolean,
): string | null {
  const term = text.trim();
  if (term.length < 2 || term.length > 30) return null;
  if (!node || !isInsideArticle(node)) return null;
  return term;
}

/**
 * R3.3：术语划词解释——选中正文术语弹出浮层，复用 /api/ai/chat 的 RAG 管线。
 * 消耗与问答相同的游客/登录配额。
 */
export function TermExplainer({
  locale,
  chapterSlug,
  aiEnabled = true,
  dict,
}: {
  locale: string;
  chapterSlug: string;
  /** R3.9：无 key 环境由服务端页传入 false */
  aiEnabled?: boolean;
  dict: TermExplainerDict;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [term, setTerm] = useState<string | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  // R3.9/R3.10：AI 关闭时不挂任何监听
  const enabled = aiEnabled && !isAiGloballyDisabled();

  useEffect(() => {
    if (!enabled) return;
    function onMouseUp(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // 点击浮层内部不关闭
      if (popRef.current?.contains(target)) return;
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed) {
        setPos(null);
        return;
      }
      const found = shouldExplain(
        sel.toString(),
        sel.anchorNode,
        (n) => !!(n.parentElement?.closest?.("article")),
      );
      if (!found) {
        setPos(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setPos({ top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX });
      setTerm(found);
      setDefinition(null);
      setFailed(false);
    }
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, [enabled]);

  async function explain(t: string) {
    setLoading(true);
    setFailed(false);
    trackAiClick("term-explainer", { chapter: chapterSlug });
    try {
      const question =
        locale === "en"
          ? `Explain the trading term "${t}" in one or two sentences for a beginner.`
          : `用一两句话解释交易术语「${t}」。`;
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: question }],
          locale,
          contextChapter: chapterSlug,
        }),
      });
      if (!res.ok) throw new Error("failed");
      const text = await res.text();
      setDefinition(text.trim() || null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  if (!enabled) return null;

  return (
    <>
      {pos && (
        <div
          ref={popRef}
          className="absolute z-50 w-72 rounded-xl border border-[var(--accent)]/40 bg-[var(--surface)] p-4 shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          <p className="text-xs font-mono text-faint mb-2">🤖 {term}</p>
          {loading && <p className="text-xs text-muted animate-pulse">{dict.loading}</p>}
          {!loading && !definition && !failed && (
            <button
              onClick={() => term && explain(term)}
              className="w-full rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-dim)] px-3 py-2 text-xs text-accent hover:border-accent/60 transition"
            >
              {dict.hint}
            </button>
          )}
          {definition && (
            <p className="text-xs text-muted leading-relaxed">{definition}</p>
          )}
          {failed && <p className="text-xs text-down">{dict.error}</p>}
          <p className="mt-2 text-[10px] text-faint">{dict.disclaimer}</p>
        </div>
      )}
    </>
  );
}
