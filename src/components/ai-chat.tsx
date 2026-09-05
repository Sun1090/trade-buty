"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
// R7.1：Markdown 渲染链（react-markdown+rehype）按需加载——回答到达前不需要
const Markdown = dynamic(() => import("@/components/markdown").then((m) => m.Markdown), {
  ssr: false,
  loading: () => (
    <div className="space-y-2 py-1" aria-busy="true">
      <div className="h-3 rounded bg-[var(--border)] w-full animate-pulse" />
      <div className="h-3 rounded bg-[var(--border)] w-[85%] animate-pulse" />
    </div>
  ),
});
import { SUGGESTED_QUESTIONS_ZH, SUGGESTED_QUESTIONS_EN, pickRandomQuestions } from "@/lib/ai/prompt";
import { hasTruncatedMarker, stripTruncatedMarker } from "@/lib/ai/streaming";
import { reportError } from "@/lib/error-report";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { chapter: string; doc: string; title?: string }[];
  suggested?: { chapter: string; title: string }[];
  truncated?: boolean;
}

interface AiDict {
  placeholder: string;
  title: string;
  subtitle: string;
  thinking: string;
  error: string;
  errorServer: string;
  errorTimeout: string;
  retry: string;
  clear: string;
  copy: string;
  copied: string;
  continueLabel: string;
  sourcesLabel: string;
  suggestedLabel: string;
  examplesLabel: string;
  contextBannerTpl: string;
  followups: string[];
  disclaimer: string;
  guestLimit: string;
  quotaRemaining: string;
  quotaLoginHint: string;
  helpful: string;
  unhelpful: string;
}

export function AiChat({ locale, dict }: { locale: string; dict: AiDict }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // R3.7：课程落地上下文（?ctx=章节 slug & ct=章节标题，课末「问 AI」按钮带入）
  const [contextTitle, setContextTitle] = useState<string | null>(null);
  // 游客配额（服务端仅对未登录请求返回 X-Quota-* 头；登录用户为 null 不展示）
  const [quota, setQuota] = useState<{ remaining: number; limit: number } | null>(null);
  const [contextChapter, setContextChapter] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<number, "helpful" | "unhelpful">>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initRef = useRef(false);

  // R1.15：移动端软键盘弹起时保证输入框可见（dvh 只解决地址栏，键盘需主动滚动）
  useEffect(() => {
    const revealInput = () => {
      if (document.activeElement === inputRef.current) {
        inputRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
      }
    };
    const vv = window.visualViewport;
    vv?.addEventListener("resize", revealInput);
    return () => vv?.removeEventListener("resize", revealInput);
  }, []);

  // 初始化时从问题池随机取 5 个（每次进入页面看到不同推荐）
  const [suggestions] = useState(() => {
    const pool = locale === "en" ? SUGGESTED_QUESTIONS_EN : SUGGESTED_QUESTIONS_ZH;
    return pickRandomQuestions(pool, 5);
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
            setMessages(data.messages.map((m: { role: string; content: string; sources?: string | { chapter: string; doc: string; title?: string }[]; suggested?: string | { chapter: string; title: string }[] }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
              sources: m.sources ? (typeof m.sources === "string" ? JSON.parse(m.sources) : m.sources) : undefined,
              suggested: m.suggested ? (typeof m.suggested === "string" ? JSON.parse(m.suggested) : m.suggested) : undefined,
            })));
            return; // 有历史就不走 ?q= 自动发送
          }
        }
      } catch {
        // 拉历史失败不阻断
      }
      // 无历史时处理 ?q= 参数（R3.7：课末问 AI 带入 ctx/ct 上下文）
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q");
      const ctx = params.get("ctx");
      const ct = params.get("ct");
      if (ctx) {
        setContextChapter(ctx);
        if (ct) setContextTitle(ct);
      }
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

    await runStream(
      [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
      messages.length + 1,
      { userMessage: trimmed }
    );
  }

  /** 续写被截断的回答：在同一条消息上追加 */
  async function continueGeneration(idx: number) {
    const target = messages[idx];
    if (!target || loading || target.role !== "assistant") return;
    setError(null);
    setLoading(true);
    await runStream(
      messages.slice(0, idx + 1).map((m) => ({ role: m.role, content: m.content })),
      idx,
      { baseText: target.content, userMessage: "", extraBody: { continueFrom: target.content } }
    );
  }

  /**
   * 流式请求并把文本填充到指定下标的 assistant 消息。
   * @param history 发给服务端的历史（含续写所需的已有回答）
   * @param targetIdx 填充目标下标
   * @param opts.baseText 续写时的已有内容（追加基底）；userMessage 存档用问题；extraBody 额外 body 字段
   */
  async function runStream(
    history: { role: string; content: string }[],
    targetIdx: number,
    opts: {
      baseText?: string;
      userMessage?: string;
      extraBody?: Record<string, unknown>;
    } = {}
  ) {
    const baseText = opts.baseText ?? "";
    let sourcesArr: { chapter: string; doc: string; title?: string }[] | undefined;
    let suggestedArr: { chapter: string; title: string }[] | undefined;

    // 连接超时（只约束到响应头到达，正文流式期不计入）
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          locale,
          ...(contextChapter ? { contextChapter } : {}),
          ...opts.extraBody,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const qLimit = res.headers.get("X-Quota-Limit");
      const qRemaining = res.headers.get("X-Quota-Remaining");
      if (qLimit && qRemaining) {
        setQuota({ limit: parseInt(qLimit), remaining: parseInt(qRemaining) });
      }

      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        const hint = retryAfter
          ? ` (${Math.ceil(parseInt(retryAfter) / 60)}min)`
          : "";
        throw new Error(dict.guestLimit + hint);
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        if (res.status >= 500) throw new Error(dict.errorServer);
        throw new Error(errBody.error || dict.error);
      }

      const sources = res.headers.get("X-Sources");
      sourcesArr = sources ? JSON.parse(decodeURIComponent(sources)) : undefined;
      const suggested = res.headers.get("X-Suggested");
      suggestedArr = suggested ? JSON.parse(decodeURIComponent(suggested)) : undefined;

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      const parts: string[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(decoder.decode(value, { stream: true }));
          const acc = baseText + parts.join("");
          setMessages((prev) => {
            const next = [...prev];
            next[targetIdx] = {
              role: "assistant",
              content: acc,
              sources: sourcesArr,
              suggested: suggestedArr,
              truncated: false,
            };
            return next;
          });
        }
      } else {
        // 非流式回退：骨架屏期间一次性读全文
        const text = await res.text();
        if (text) parts.push(text);
      }

      if (parts.length === 0) throw new Error(dict.error);

      const rawFull = baseText + parts.join("");
      const truncated = hasTruncatedMarker(rawFull);
      const fullResponse = stripTruncatedMarker(rawFull);
      // 落盘干净文本 + 截断标记
      setMessages((prev) => {
        const next = [...prev];
        const cur = next[targetIdx];
        if (cur) {
          next[targetIdx] = {
            ...cur,
            content: fullResponse,
            truncated,
            sources: sourcesArr ?? cur.sources,
            suggested: suggestedArr ?? cur.suggested,
          };
        }
        return next;
      });

      // 存对话到云端（登录用户，fire-and-forget）
      void fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: opts.userMessage ?? "",
          assistantMessage: fullResponse,
          sources: sourcesArr,
        }),
      }).catch(() => {});
    } catch (e) {
      clearTimeout(timer);
      // R7.6：单次请求失败 = 可恢复错误（用户已见错误框，可重试）
      reportError("recoverable", "ai-chat", e);
      // 错误分级：超时 / 网络或服务不可用 / 服务端业务文案 / 兜底
      const msg =
        e instanceof DOMException && e.name === "AbortError"
          ? dict.errorTimeout
          : e instanceof TypeError
            ? dict.errorServer
            : e instanceof Error
              ? e.message
              : dict.error;
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

  /** R1.13：引用点击上报（fire-and-forget，失败静默） */
  function trackCitation(
    kind: "source" | "suggested",
    s: { chapter: string; doc?: string },
    msgIdx: number
  ) {
    const userQ = [...messages.slice(0, msgIdx)].reverse().find((m) => m.role === "user");
    void fetch("/api/ai/citation-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        chapter: s.chapter,
        doc: s.doc,
        question: userQ?.content,
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

  /** R3.4：追问链——从最后一条回答的引用/推荐标题生成 3 个关联问题 */
  function followupsFor(idx: number): string[] {
    const msg = messages[idx];
    if (!msg || messages.length === 0 || idx !== messages.length - 1) return [];
    const title = msg.sources?.[0]?.title ?? msg.suggested?.[0]?.title;
    if (!title) return [];
    return dict.followups.map((tpl) => tpl.replace("{t}", title));
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)]">
      {/* R3.7：课程上下文横幅 */}
      {contextTitle && (
        <div className="px-4 pt-3">
          <p className="mx-auto max-w-3xl rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-dim)] px-3 py-2 text-xs text-accent">
            📖 {dict.contextBannerTpl.replace("{title}", contextTitle)}
          </p>
        </div>
      )}

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
              <p className="mt-8 text-xs font-medium uppercase tracking-wide text-faint">
                {dict.examplesLabel}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
                    // 首个 token 未到：骨架屏 + 思考文案；流式到达后逐字填充
                    <div aria-busy="true">
                      <span className="text-xs text-faint">{dict.thinking}</span>
                      <div className="mt-2 space-y-2" data-testid="chat-skeleton">
                        <div className="h-3 rounded bg-[var(--border)] w-full animate-pulse" />
                        <div className="h-3 rounded bg-[var(--border)] w-[85%] animate-pulse" />
                        <div className="h-3 rounded bg-[var(--border)] w-[60%] animate-pulse" />
                      </div>
                    </div>
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
                    {msg.suggested && msg.suggested.length > 0 && (!msg.sources || msg.sources.length === 0) && (
                      <>
                        <span className="text-xs text-faint">{dict.suggestedLabel}:</span>
                        {msg.suggested.map((s, j) => (
                          <a
                            key={j}
                            href={p(`/knowledge/${s.chapter}`)}
                            title={s.chapter}
                            onClick={() => trackCitation("suggested", s, i)}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] px-2.5 py-0.5 text-xs text-muted hover:text-accent hover:border-accent/60 transition"
                          >
                            📚 {s.title}
                          </a>
                        ))}
                      </>
                    )}
                    {msg.sources && msg.sources.length > 0 && (
                      <>
                        <span className="text-xs text-faint">{dict.sourcesLabel}:</span>
                        {msg.sources.map((s, j) => (
                          <a
                            key={j}
                            href={p(`/knowledge/${s.chapter}/${s.doc}`)}
                            title={`${s.chapter}/${s.doc}`}
                            onClick={() => trackCitation("source", s, i)}
                            className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)]/30 px-2.5 py-0.5 text-xs text-accent hover:border-accent/60 transition"
                          >
                            📖 {s.title ?? `${s.chapter}/${s.doc}`}
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
                    {msg.truncated && !loading && (
                      <button
                        onClick={() => continueGeneration(i)}
                        className="text-xs text-accent hover:underline underline-offset-4 transition"
                      >
                        {dict.continueLabel} →
                      </button>
                    )}
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
                    {/* 追问按钮 */}
                    <span className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => send(locale === "en" ? "Simplify this" : "简化解释")}
                        className="text-[10px] text-faint hover:text-accent transition border border-[var(--border)] rounded px-1.5 py-0.5"
                      >
                        {locale === "en" ? "Simplify" : "简化"}
                      </button>
                      <button
                        onClick={() => send(locale === "en" ? "Give an example" : "举个例子")}
                        className="text-[10px] text-faint hover:text-accent transition border border-[var(--border)] rounded px-1.5 py-0.5"
                      >
                        {locale === "en" ? "Example" : "例子"}
                      </button>
                    </span>
                  </div>
                )}
                {/* R3.4：追问链 chips */}
                {!loading && followupsFor(i).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {followupsFor(i).map((fq) => (
                      <button
                        key={fq}
                        onClick={() => send(fq)}
                        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-muted hover:text-accent hover:border-accent/60 transition"
                      >
                        💬 {fq}
                      </button>
                    ))}
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
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => {
                // 键盘弹起动画完成后补一次滚动，避免输入框被遮挡
                window.setTimeout(
                  () => inputRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }),
                  300
                );
              }}
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
          {/* 游客配额提示：有剩余展示次数，用尽引导登录 */}
          {quota && (
            <p className="mt-1 text-[10px] text-faint">
              {quota.remaining > 0 ? (
                dict.quotaRemaining.replace("{n}", String(quota.remaining))
              ) : (
                <a href={`/${locale}/auth`} className="text-accent underline underline-offset-4">
                  {dict.quotaLoginHint}
                </a>
              )}
            </p>
          )}
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
