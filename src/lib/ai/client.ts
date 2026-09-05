/**
 * P3 AI 陪学：通用 LLM / Embedding 客户端
 *
 * 用原生 fetch，不锁死任何厂商 SDK。
 * 上游请求统一走 R7.5 的 fetchWithTimeoutRetry（超时 + 幂等重试）。
 * 兼容任何 OpenAI Chat Completions / Embeddings 格式的端点。
 *
 * 三模型 fallback 链：glm-5.2 → deepseek-v4-flash → sensenova-6.8-flash-lite
 * 第一个失败（超时/5xx/429）自动降级到下一个，全部失败才抛错。
 * 所有 SenseNova 模型默认开启思考模式，这里统一 reasoning_effort: "none"
 * 关掉，流式直接出 content（否则先吐一长串 reasoning，max_tokens 不够时 content 不出来）。
 */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** 流结束时回调 finish_reason（length 表示被截断） */
  onFinish?: (reason: string | null) => void;
}

import { fetchWithTimeoutRetry } from "./http";

const API_URL = process.env.AI_API_URL || "";
const API_KEY = process.env.AI_API_KEY || "";

/** fallback 链：优先用 env 配的，其后按固定顺序兜底 */
function getModelChain(): string[] {
  const primary = process.env.AI_MODEL;
  const chain = ["glm-5.2", "deepseek-v4-flash", "sensenova-6.8-flash-lite"];
  if (primary && !chain.includes(primary)) return [primary, ...chain];
  // 把 primary 放链首（去重）
  return primary ? [primary, ...chain.filter((m) => m !== primary)] : chain;
}

/**
 * 尝试单个模型，返回流式 ReadableStream。
 * 失败时抛错，由上层 catch 后尝试下一个模型。
 */
async function tryModel(
  model: string,
  opts: ChatOptions,
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();

  const res = await fetchWithTimeoutRetry(`${API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      stream: true,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 1500,
      reasoning_effort: "none",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI ${model} ${res.status}: ${err.substring(0, 100)}`);
  }
  if (!res.body) throw new Error(`AI ${model} 无响应流`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = ""; // SSE 可能跨 chunk，保留未完成的行
  let finishReason: string | null = null;
  const notifyFinish = () => {
    try {
      opts.onFinish?.(finishReason);
    } catch {
      // 回调异常不影响主流程
    }
  };

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        notifyFinish();
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // 最后一段可能不完整，留到下次
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          notifyFinish();
          controller.close();
          return;
        }
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta;
          // 只取正式回答 content；reasoning / reasoning_content 是思维链，不发给前端
          const token = delta?.content;
          if (token) controller.enqueue(encoder.encode(token));
          const fr = json.choices?.[0]?.finish_reason;
          if (typeof fr === 'string' && fr) finishReason = fr;
        } catch {
          // 跳过不完整的 JSON
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

/**
 * 三模型 fallback 流式对话。
 * 按链顺序尝试，第一个成功返回流；全部失败抛最后一个错误。
 */
export async function streamChat(
  opts: ChatOptions,
): Promise<ReadableStream<Uint8Array>> {
  const chain = getModelChain();
  let lastErr: Error | null = null;
  for (const model of chain) {
    try {
      return await tryModel(model, opts);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      // 429/5xx/超时 → 降级；400 类参数错误也降级（不同模型参数可能不同）
      console.error(`[ai] ${model} 失败，降级下一个:`, lastErr.message);
    }
  }
  throw lastErr ?? new Error("所有 AI 模型均不可用");
}

/**
 * 非流式对话（用于 AI 出题等需要完整 JSON 的场景）。
 * 同样走三模型 fallback。
 */
export async function chat(opts: ChatOptions): Promise<string> {
  const chain = getModelChain();
  let lastErr: Error | null = null;
  for (const model of chain) {
    try {
      const res = await fetchWithTimeoutRetry(`${API_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: opts.messages,
          stream: false,
          temperature: opts.temperature ?? 0.5,
          max_tokens: opts.maxTokens ?? 1500,
          reasoning_effort: "none",
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`AI ${model} ${res.status}: ${err.substring(0, 100)}`);
      }
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      if (content) return content;
      throw new Error(`AI ${model} 返回空`);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      console.error(`[ai] ${model} 非流式失败，降级:`, lastErr.message);
    }
  }
  throw lastErr ?? new Error("所有 AI 模型均不可用");
}

/**
 * 生成 embedding 向量（用于 RAG 检索和查询向量化）。
 * 返回 number[]（bge-m3，1024 维）。
 */
export async function embed(text: string): Promise<number[]> {
  const embedUrl = process.env.AI_EMBEDDING_URL || API_URL;
  const embedModel = process.env.AI_EMBEDDING_MODEL || "text-embedding-3-small";
  const embedKey = process.env.AI_EMBEDDING_KEY || API_KEY;

  const res = await fetchWithTimeoutRetry(`${embedUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${embedKey}`,
    },
    body: JSON.stringify({
      model: embedModel,
      input: text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API ${res.status}: ${err.substring(0, 200)}`);
  }

  const json = await res.json();
  return json.data?.[0]?.embedding ?? [];
}
