"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/markdown";
import { SUGGESTED_QUESTIONS_ZH, SUGGESTED_QUESTIONS_EN } from "@/lib/ai/prompt";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { chapter: string; doc: string }[];
}

interface AiDict {
  placeholder: string;
  title: string;
  subtitle: string;
  thinking: string;
  error: string;
  retry: string;
  clear: string;
  copy: string;
  copied: string;
  sourcesLabel: string;
  disclaimer: string;
  guestLimit: string;
  helpful: string;
  unhelpful: string;
}

export function AiChat({ locale, dict }: { locale: string; dict: AiDict }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<number, "helpful" | "unhelpful">>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);

  // 初始化时从问题池随机取 5 个（每次进入页面看到不同推荐）
  const [suggestions] = useState(() => {
    const pool = locale === "en" ? SUGGESTED_QUESTIONS_EN : SUGGESTED_QUESTIONS_ZH;
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
  });

  // 自动滚到底
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // 进入时拉云端历史（登录用户恢复上次对话）
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/ai/conversations");
        if (res.ok) {
          const data = await res.json();
          if (data.messages?.length > 0) {
            setMessages(data.messages.map((m: { role: string; content: string; sources?: string | { chapter: string; doc: string }[] }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
              sources: m.sources ? (typeof m.sources === "string" ? JSON.parse(m.sources) : m.sources) : undefined,
            })));
            return; // 有历史就不走 ?q= 自动发送
          }
        }
      } catch {
        // 拉历史失败不阻断
      }
      // 无历史时处理 ?q= 参数
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q");
      if (q) send(q);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    // 追加一个空的 assistant 消息用于流式填充
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    let fullResponse = "";
    let sourcesArr: { chapter: string; doc: string }[] | undefined;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          locale,
        }),
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        const hint = retryAfter
          ? ` (${Math.ceil(parseInt(retryAfter) / 60)}min)`
          : "";
        throw new Error(dict.guestLimit + hint);
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || dict.error);
      }

      const sources = res.headers.get("X-Sources");
      sourcesArr = sources ? JSON.parse(sources) : undefined;

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      const parts: string[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(decoder.decode(value, { stream: true }));
          const acc = parts.join("");
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              role: "assistant",
              content: acc,
              sources: sourcesArr,
            };
            return next;
          });
        }
      }

      if (parts.length === 0) throw new Error(dict.error);

      fullResponse = parts.join("");

      // 存对话到云端（登录用户，fire-and-forget）
      void fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: trimmed,
          assistantMessage: fullResponse,
          sources: sourcesArr,
        }),
      }).catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : dict.error;
      setError(msg);
      // 移除空的 assistant 消息
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setMessages([]);
    setError(null);
    setFeedback({});
  }

  async function sendFeedback(
    msgIdx: number,
    rating: "helpful" | "unhelpful",
    msg: ChatMessage,
  ) {
    if (feedback[msgIdx]) return; // 已反馈过
    setFeedback((prev) => ({ ...prev, [msgIdx]: rating }));
    // 找对应的用户问题
    const userQ = [...messages.slice(0, msgIdx)].reverse().find((m) => m.role === "user");
    void fetch("/api/ai/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating,
        question: userQ?.content ?? "",
        answer: msg.content,
      }),
    }).catch(() => {});
  }

  async function copyMsg(text: string, e: React.MouseEvent) {
    try {
      await navigator.clipboard.writeText(text);
      const btn = e.currentTarget as HTMLButtonElement;
      const orig = btn.textContent;
      btn.textContent = dict.copied;
      setTimeout(() => (btn.textContent = orig), 1500);
    } catch {
      // ignore
    }
  }

  const p = (path: string) => `/${locale}${path}`;

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)]">
      {/* 消息区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-[var(--accent-dim)] to-transparent border border-[var(--accent)]/30 mb-4">
                <span className="text-3xl" aria-hidden>🤖</span>
              </div>
              <h2 className="text-xl font-bold">{dict.title}</h2>
              <p className="mt-2 text-sm text-muted max-w-md mx-auto leading-relaxed">
                {dict.subtitle}
              </p>
              <div className="mt-8 grid gap-2 sm:grid-cols-2">
                {suggestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-left text-muted hover:text-accent hover:border-[var(--accent)]/50 hover:bg-[var(--accent-dim)] transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] ${msg.role === "user" ? "" : "w-full"}`}>
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-accent-strong text-white dark:text-[#06281c]"
                      : "border border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  {msg.role === "assistant" && !msg.content && loading ? (
                    <span className="flex gap-1 py-1">
                      <span className="h-2 w-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: "300ms" }} />
                    </span>
                  ) : msg.role === "assistant" ? (
                    <div className="kb-prose">
                      <Markdown content={msg.content} />
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  )}
                </div>

                {/* 来源引用 + 操作 */}
                {msg.role === "assistant" && msg.content && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {msg.sources && msg.sources.length > 0 && (
                      <>
                        <span className="text-xs text-faint">{dict.sourcesLabel}:</span>
                        {msg.sources.map((s, j) => (
                          <a
                            key={j}
                            href={p(`/knowledge/${s.chapter}/${s.doc}`)}
                            className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)]/30 px-2.5 py-0.5 text-xs text-accent hover:border-accent/60 transition"
                          >
                            📖 {s.chapter}/{s.doc}
                          </a>
                        ))}
                      </>
                    )}
                    <button
                      onClick={(e) => copyMsg(msg.content, e)}
                      className="text-xs text-faint hover:text-accent transition"
                    >
                      {dict.copy}
                    </button>
                    <span className="ml-auto flex items-center gap-1">
                      <button
                        onClick={() => sendFeedback(i, "helpful", msg)}
                        className={`text-xs transition ${feedback[i] === "helpful" ? "text-accent font-medium" : "text-faint hover:text-accent"}`}
                        aria-label={dict.helpful}
                      >
                        👍
                      </button>
                      <button
                        onClick={() => sendFeedback(i, "unhelpful", msg)}
                        className={`text-xs transition ${feedback[i] === "unhelpful" ? "text-down font-medium" : "text-faint hover:text-down"}`}
                        aria-label={dict.unhelpful}
                      >
                        👎
                      </button>
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="px-4 pb-2">
          <div className="mx-auto max-w-3xl rounded-xl border border-[var(--down)]/30 bg-[var(--down)]/10 p-3 flex items-center justify-between gap-3">
            <p className="text-sm text-down">{error}</p>
            <button
              onClick={() => { setError(null); send(messages.filter((m) => m.role === "user").pop()?.content || ""); }}
              className="text-xs text-accent underline underline-offset-4 shrink-0"
            >
              {dict.retry}
            </button>
          </div>
        </div>
      )}

      {/* 输入区 */}
      <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--background)]">
        <div className="mx-auto max-w-3xl">
          {messages.length > 0 && (
            <button
              onClick={() => {
                if (messages.length > 0 && !window.confirm(locale === "en" ? "Clear all messages?" : "清空所有对话？")) return;
                clear();
              }}
              className="mb-2 text-xs text-faint hover:text-accent transition"
            >
              {dict.clear}
            </button>
          )}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={dict.placeholder}
              aria-label={dict.placeholder}
              maxLength={500}
              disabled={loading}
              className="flex-1 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus:border-accent/50 focus:shadow-[0_0_0_3px_var(--accent-dim)] transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-3 text-sm transition disabled:opacity-50 shrink-0"
            >
              {loading ? "…" : "→"}
            </button>
          </form>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[10px] text-faint">{dict.disclaimer}</p>
            <span className={`text-[10px] font-mono ${input.length > 450 ? "text-down" : "text-faint"}`}>
              {input.length}/500
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
