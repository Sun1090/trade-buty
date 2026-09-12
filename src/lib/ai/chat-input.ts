/**
 * R7.12：AI 问答请求体校验。
 *
 * 之前 chat route 直接 `(await req.json()) as ChatBody`，运行时完全不校验：
 * 1. body 不是 JSON / messages 不是数组 → 抛错，返回 500 而不是 400；
 * 2. messages 里的 role 不受限，客户端可以塞 `role: "system"` 的消息，
 *    被原样拼进上游 messages，等于绕过 system prompt（越权指令注入）；
 * 3. content 无长度上限、messages 无条数上限 → 单请求可塞入任意大 payload。
 *
 * 这里统一收敛：只允许 user/assistant 两种角色、限制条数与字符数、
 * locale 白名单，并导出供 Route Handler 回归测试覆盖。
 */

/** 单轮消息（服务端只接受这两种角色；system 由服务端自己拼） */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequestBody {
  messages: ChatTurn[];
  locale: "zh" | "en";
  /** 续写：已有回答全文（服务端在其后继续生成） */
  continueFrom?: string;
  /** 用户正在学习的章节 slug */
  contextChapter?: string;
}

/** 最多 40 轮（20 组问答），足够覆盖摘要路径且避免超长上下文费用 */
export const MAX_CHAT_TURNS = 40;
/** 单轮正文上限：正常提问远小于此，超过视为滥用 */
export const MAX_CHAT_CONTENT_CHARS = 8_000;
/** 续写原文上限（约等于两轮正文） */
export const MAX_CONTINUE_FROM_CHARS = 16_000;
/** 章节 slug 形状（与知识库目录名一致） */
const CHAPTER_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** 校验并规范化 AI 问答请求体；非法返回 null（调用方回 400）。 */
export function parseChatBody(value: unknown): ChatRequestBody | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;

  if (!Array.isArray(body.messages)) return null;
  if (body.messages.length === 0 || body.messages.length > MAX_CHAT_TURNS) return null;

  const messages: ChatTurn[] = [];
  let hasUserTurn = false;
  for (const item of body.messages) {
    if (typeof item !== "object" || item === null) return null;
    const row = item as Record<string, unknown>;
    if (row.role !== "user" && row.role !== "assistant") return null;
    if (typeof row.content !== "string") return null;
    const content = row.content.trim();
    if (!content || content.length > MAX_CHAT_CONTENT_CHARS) return null;
    if (row.role === "user") hasUserTurn = true;
    messages.push({ role: row.role, content });
  }
  // 没有用户提问就没有可回答的问题
  if (!hasUserTurn) return null;

  const locale = body.locale === "en" ? "en" : "zh";

  let continueFrom: string | undefined;
  if (body.continueFrom !== undefined) {
    if (typeof body.continueFrom !== "string") return null;
    const trimmed = body.continueFrom.trim();
    if (trimmed.length > MAX_CONTINUE_FROM_CHARS) return null;
    if (trimmed) continueFrom = trimmed;
  }

  let contextChapter: string | undefined;
  if (body.contextChapter !== undefined) {
    if (typeof body.contextChapter !== "string") return null;
    const slug = body.contextChapter.trim();
    // 未知章节由调用方忽略；这里只收形状合法的 slug，避免把任意文本拼进 prompt
    if (slug && CHAPTER_SLUG.test(slug)) contextChapter = slug;
  }

  return {
    messages,
    locale,
    ...(continueFrom ? { continueFrom } : {}),
    ...(contextChapter ? { contextChapter } : {}),
  };
}
