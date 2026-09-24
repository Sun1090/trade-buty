"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
// R7.1：Markdown 渲染链（react-markdown+rehype）按需加载——回答到达前不需要
const Markdown = dynamic(
  () => import("@/components/markdown").then((m) => m.Markdown),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-2 py-1" aria-busy="true">
        <div className="h-3 rounded bg-[var(--border)] w-full animate-pulse" />
        <div className="h-3 rounded bg-[var(--border)] w-[85%] animate-pulse" />
      </div>
    ),
  },
);
import {
  SUGGESTED_QUESTIONS_ZH,
  SUGGESTED_QUESTIONS_EN,
  pickRandomQuestions,
} from "@/lib/ai/prompt";
import { hasTruncatedMarker, stripTruncatedMarker } from "@/lib/ai/streaming";
import { useAuth } from "@/components/auth-provider";
import { reportError } from "@/lib/error-report";
import { copyText } from "@/lib/clipboard";

/** 空状态首屏示例条数：水合首帧与挂载后洗牌必须取同一个数 */
const EXAMPLE_COUNT = 5;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { chapter: string; doc: string; title?: string }[];
  suggested?: { chapter: string; title: string }[];
  truncated?: boolean;
}

interface ConversationRow {
  role: string;
  content: string;
  sources?: string | { chapter: string; doc: string; title?: string }[];
  suggested?: string | { chapter: string; title: string }[];
}

function parseJsonField<T>(
  value: ConversationRow["sources"] | ConversationRow["suggested"],
): T[] | undefined {
  if (!value) return undefined;
  return (typeof value === "string" ? JSON.parse(value) : value) as T[];
}

/**
 * 云端行 → 界面消息。库里一轮存两行（问 + 答），续写会把同一轮再存一份，
 * 所以「同一问题 + 前一份带截断标记」要折叠成最新的那一份，否则刷新后
 * 半截答案和完整答案会并排出现。截断标记在这里剥掉：带着它，「继续生成」
 * 的入口就再也回不来了（标记本身决定这一轮是否还没说完）。
 */
function rowsToMessages(rows: ConversationRow[]): ChatMessage[] {
  const parsed = rows.map((m) => ({
    role: m.role as "user" | "assistant",
    truncated: m.role === "assistant" && hasTruncatedMarker(m.content),
    content: m.role === "assistant" ? stripTruncatedMarker(m.content) : m.content,
    sources: parseJsonField<{ chapter: string; doc: string; title?: string }>(m.sources),
    suggested: parseJsonField<{ chapter: string; title: string }>(m.suggested),
  }));

  const collapsed: ChatMessage[] = [];
  for (let i = 0; i < parsed.length; i += 1) {
    const row = parsed[i];
    const answer = parsed[i + 1];
    if (row.role !== "user" || !answer || answer.role !== "assistant") {
      collapsed.push(row);
      continue;
    }
    const previous = collapsed[collapsed.length - 2];
    if (
      collapsed.length >= 2 &&
      previous?.role === "user" &&
      previous.content === row.content &&
      collapsed[collapsed.length - 1]?.truncated
    ) {
      // 同一问第二次：上一份是被截断的旧存档，这一份才是完整版
      collapsed.splice(collapsed.length - 2, 2, row, answer);
      i += 1;
      continue;
    }
    collapsed.push(row, answer);
    i += 1;
  }
  return collapsed;
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
  clearFailed: string;
  copy: string;
  copied: string;
  copyFailed: string;
  continueLabel: string;
  sourcesLabel: string;
  suggestedLabel: string;
  examplesLabel: string;
  contextBannerTpl: string;
  followups: string[];
  disclaimer: string;
  guestLimit: string;
  /** 等待时长整句由字典出，单位也在句子里：拼 ` (2min)` 到中文界面就是半句英文残话 */
  retryInTpl: string;
  quotaRemaining: string;
  quotaLoginHint: string;
  helpful: string;
  unhelpful: string;
}

export function AiChat({ locale, dict }: { locale: string; dict: AiDict }) {
  const auth = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // R3.7：课程落地上下文（?ctx=章节 slug & ct=章节标题，课末「问 AI」按钮带入）
  const [contextTitle, setContextTitle] = useState<string | null>(null);
  // 游客配额（服务端仅对未登录请求返回 X-Quota-* 头；登录用户为 null 不展示）
  const [quota, setQuota] = useState<{
    remaining: number;
    limit: number;
  } | null>(null);
  const [contextChapter, setContextChapter] = useState<string | null>(null);
  // 从 URL 带进来的问题：等历史落进 state 后再发，见 pendingAskRef 消费处
  const pendingAskRef = useRef<{ text: string; ctx: string | null } | null>(
    null,
  );
  const [historySettled, setHistorySettled] = useState(false);
  // 「清空对话」的代际：流式回答结束时要对齐它，否则会把刚清掉的对话写回云端
  const archiveGenerationRef = useRef(0);
  /** 在途的那次 /api/ai/chat：「清空对话」要能把它掐掉 */
  const streamControllerRef = useRef<AbortController | null>(null);
  const [feedback, setFeedback] = useState<
    Record<number, "helpful" | "unhelpful">
  >({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initRef = useRef(false);
  const accountRef = useRef<string | null | undefined>(undefined);

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

  // 初始化时从问题池随机取 5 个（每次进入页面看到不同推荐）。
  // 渲染期只能取确定值：这条路是静态页，服务端 HTML 构建时就固化了，
  // 水合首帧与它不一致会让 React 丢掉整棵服务端树重渲染。
  const pool = locale === "en" ? SUGGESTED_QUESTIONS_EN : SUGGESTED_QUESTIONS_ZH;
  const [suggestions, setSuggestions] = useState(() => pool.slice(0, EXAMPLE_COUNT));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSuggestions(pickRandomQuestions(pool, EXAMPLE_COUNT));
  }, [pool]);

  // 自动滚到底
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  // 进入时拉云端历史（登录用户恢复上次对话）
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      // R3.7：课末/错题的「问 AI」把问题和章节放在 URL 上带过来。
      // 参数先解析、先消费：上下文横幅跟历史无关都要出现，问题则等历史落定后再发。
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q");
      const ctx = params.get("ctx");
      const ct = params.get("ct");
      if (ctx) {
        setContextChapter(ctx);
        if (ct) setContextTitle(ct);
      }
      if (q || ctx || ct) {
        // 地址栏里的问题是一次性交接口：留着的话刷新会把同一个问题再问一遍、白扣配额
        window.history.replaceState({}, "", window.location.pathname);
      }
      try {
        const res = await fetch("/api/ai/conversations");
        if (res.ok) {
          const data = await res.json();
          if (data.messages?.length > 0) {
            setMessages(rowsToMessages(data.messages));
          }
        }
      } catch {
        // 拉历史失败不阻断
      }
      // send() 读的是渲染期的 messages，所以不能在这里直接调用：
      // 上面那份历史还没进 state，带旧上下文的多轮请求会被截成空数组。
      if (q) pendingAskRef.current = { text: q, ctx: ctx ?? null };
      setHistorySettled(true);
    })();
  }, []);

  // 自动提问：本 effect 与 setHistorySettled 同一次提交后运行，闭包里的 messages 已是恢复好的历史
  useEffect(() => {
    if (!historySettled) return;
    const ask = pendingAskRef.current;
    if (!ask) return;
    pendingAskRef.current = null;
    void send(ask.text, { contextChapter: ask.ctx });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historySettled]);

  // 登出或换号：云端历史按身份拉取，上一个账号的对话不能继续留在屏幕上
  // （/api/ai/conversations 只在有会话时返回内容，组件此前从不感知身份变化）。
  // 游客登录（null → id）不清：那是同一个人自己的会话，接着聊才是对的。
  useEffect(() => {
    const accountId = auth?.id ?? null;
    if (accountRef.current === undefined) {
      accountRef.current = accountId;
      return;
    }
    if (accountRef.current === accountId) return;
    const previous = accountRef.current;
    accountRef.current = accountId;
    if (previous === null) return;
    setMessages([]);
    setFeedback({});
    setQuota(null);
    setInput("");
    setError(null);
    setContextChapter(null);
    setContextTitle(null);
  }, [auth?.id]);

  async function send(
    text: string,
    sendOpts: { contextChapter?: string | null } = {},
  ) {
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
      { userMessage: trimmed, contextChapter: sendOpts.contextChapter },
    );
  }

  /** 续写被截断的回答：在同一条消息上追加 */
  async function continueGeneration(idx: number) {
    const target = messages[idx];
    if (!target || loading || target.role !== "assistant") return;
    setError(null);
    setLoading(true);
    // 续写补的是同一轮：存档得带上这一轮的问题与来源，否则服务端按畸形载荷拒掉，
    // 用户看到的完整答案刷新后就又变回半截。
    const question = messages.slice(0, idx).filter((m) => m.role === "user").pop();
    await runStream(
      messages
        .slice(0, idx + 1)
        .map((m) => ({ role: m.role, content: m.content })),
      idx,
      {
        baseText: target.content,
        userMessage: question?.content ?? "",
        archiveSources: target.sources,
        extraBody: { continueFrom: target.content },
      },
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
      contextChapter?: string | null;
      archiveSources?: ChatMessage["sources"];
    } = {},
  ) {
    const activeContextChapter = opts.contextChapter ?? contextChapter;
    const baseText = opts.baseText ?? "";
    // 归档要的这一问题：服务端把空问题判成畸形载荷，所以没有归属问题的续写
    // 只能放弃存档——发出去也一定是 400，静默失败比不存更糟。
    const archiveQuestion = opts.userMessage?.trim() ?? "";
    // 回答在流式返回时用户可能点了「清空对话」；那一轮不能再被归档回云端，
    // 否则刚清掉的 history 会被这一次 POST 原样写回去。
    const generation = archiveGenerationRef.current;
    let sourcesArr:
      { chapter: string; doc: string; title?: string }[] | undefined;
    let suggestedArr: { chapter: string; title: string }[] | undefined;

    // 连接超时（只约束到响应头到达，正文流式期不计入）
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    // 「清空对话」要掐得掉这一趟：只清数组的话，下一块会把回答重新写回空屏幕
    streamControllerRef.current = controller;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          locale,
          ...(activeContextChapter
            ? { contextChapter: activeContextChapter }
            : {}),
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
        const retryAfter = Number.parseInt(res.headers.get("retry-after") ?? "", 10);
        const minutes = Number.isFinite(retryAfter) ? Math.ceil(retryAfter / 60) : 0;
        throw new Error(
          minutes > 0
            ? `${dict.guestLimit} · ${dict.retryInTpl.replace("{n}", String(minutes))}`
            : dict.guestLimit
        );
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        if (res.status >= 500) throw new Error(dict.errorServer);
        throw new Error(errBody.error || dict.error);
      }

      const sources = res.headers.get("X-Sources");
      const suggested = res.headers.get("X-Suggested");
      try {
        sourcesArr = sources ? JSON.parse(decodeURIComponent(sources)) : undefined;
        suggestedArr = suggested
          ? JSON.parse(decodeURIComponent(suggested))
          : undefined;
      } catch {
        // 来源/推荐是可观测元数据，坏响应头不能把解析异常泄漏到聊天区。
        throw new Error(dict.error);
      }

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
            if (archiveGenerationRef.current !== generation) return prev; // 已清空：这一轮的字不再上屏
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
        if (archiveGenerationRef.current !== generation) return prev;
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

      // 存对话到云端（登录用户，fire-and-forget）。存的是带截断标记的原文：
      // 恢复时靠它决定「这一轮还没说完」，并给回「继续生成」的入口。
      if (archiveQuestion && archiveGenerationRef.current === generation) {
        void fetch("/api/ai/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userMessage: archiveQuestion,
            assistantMessage: rawFull,
            sources: sourcesArr ?? opts.archiveSources,
          }),
        }).catch(() => {});
      }
    } catch (e) {
      clearTimeout(timer);
      // 用户点了「清空对话」把这一轮掐了：那是他自己的动作，不该再弹一个错误框
      if (archiveGenerationRef.current !== generation) return;
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
        if (last?.role === "assistant" && !last.content)
          return prev.slice(0, -1);
        return prev;
      });
    } finally {
      if (streamControllerRef.current === controller) streamControllerRef.current = null;
      setLoading(false);
    }
  }

  async function clear() {
    // 先作废在途请求的归档权，再清本地，最后删云端：顺序反了会让那一轮又写回来。
    archiveGenerationRef.current += 1;
    streamControllerRef.current?.abort();
    setMessages([]);
    setError(null);
    setFeedback({});
    // 游客的对话本来就不落库（隐私页也是这么写的），不发无谓的删除请求
    if (!auth?.id) return;
    const res = await fetch("/api/ai/conversations", { method: "DELETE" }).catch(() => null);
    // 云端没删掉却说「已清空」，下次进页历史会整段回来——失败必须可见
    if (!res?.ok) setError(dict.clearFailed);
  }

  async function sendFeedback(
    msgIdx: number,
    rating: "helpful" | "unhelpful",
    msg: ChatMessage,
  ) {
    if (feedback[msgIdx]) return; // 已反馈过
    setFeedback((prev) => ({ ...prev, [msgIdx]: rating }));
    // 找对应的用户问题
    const userQ = [...messages.slice(0, msgIdx)]
      .reverse()
      .find((m) => m.role === "user");
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
    msgIdx: number,
  ) {
    const userQ = [...messages.slice(0, msgIdx)]
      .reverse()
      .find((m) => m.role === "user");
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
    // React 合成事件在 await 之后会清空 currentTarget，必须在异步边界前捕获按钮与原始文案。
    const btn = e.currentTarget as HTMLButtonElement;
    const orig = btn.textContent;
    // 复制是用户主动操作：失败必须可见，不能静默什么都不发生（微信内置浏览器无
    // 异步剪贴板 API 时尤其明显）。统一助手负责主路径 + execCommand 兜底并返回真实结果。
    const ok = await copyText(text);
    btn.textContent = ok ? dict.copied : dict.copyFailed;
    setTimeout(() => (btn.textContent = orig), 1500);
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
                <span className="text-3xl" aria-hidden>
                  🤖
                </span>
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
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] ${msg.role === "user" ? "" : "w-full"}`}
              >
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
                      <span className="text-xs text-faint">
                        {dict.thinking}
                      </span>
                      <div
                        className="mt-2 space-y-2"
                        data-testid="chat-skeleton"
                      >
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
                    {msg.suggested &&
                      msg.suggested.length > 0 &&
                      (!msg.sources || msg.sources.length === 0) && (
                        <>
                          <span className="text-xs text-faint">
                            {dict.suggestedLabel}:
                          </span>
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
                        <span className="text-xs text-faint">
                          {dict.sourcesLabel}:
                        </span>
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
                        onClick={() =>
                          send(locale === "en" ? "Simplify this" : "简化解释")
                        }
                        className="text-[10px] text-faint hover:text-accent transition border border-[var(--border)] rounded px-1.5 py-0.5"
                      >
                        {locale === "en" ? "Simplify" : "简化"}
                      </button>
                      <button
                        onClick={() =>
                          send(locale === "en" ? "Give an example" : "举个例子")
                        }
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
              onClick={() => {
                setError(null);
                send(
                  messages.filter((m) => m.role === "user").pop()?.content ||
                    "",
                );
              }}
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
                if (
                  messages.length > 0 &&
                  !window.confirm(
                    locale === "en" ? "Clear all messages?" : "清空所有对话？",
                  )
                )
                  return;
                void clear();
              }}
              className="mb-2 text-xs text-faint hover:text-accent transition"
            >
              {dict.clear}
            </button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
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
                  () =>
                    inputRef.current?.scrollIntoView({
                      block: "end",
                      behavior: "smooth",
                    }),
                  300,
                );
              }}
              placeholder={dict.placeholder}
              aria-label={dict.placeholder}
              maxLength={500}
              disabled={loading}
              className="flex-1 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-sm focus:border-accent/50 focus:shadow-[0_0_0_3px_var(--accent-dim)] transition-all disabled:opacity-50"
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
                dict.quotaRemaining
                .replace("{l}", String(quota.limit))
                .replace("{n}", String(quota.remaining))
              ) : (
                <a
                  href={`/${locale}/auth`}
                  className="text-accent underline underline-offset-4"
                >
                  {dict.quotaLoginHint}
                </a>
              )}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[10px] text-faint">{dict.disclaimer}</p>
            <span
              className={`text-[10px] font-mono ${input.length > 450 ? "text-down" : "text-faint"}`}
            >
              {input.length}/500
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
