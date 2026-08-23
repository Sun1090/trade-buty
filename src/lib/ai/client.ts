/**
 * P3 AI 陪学：通用 LLM / Embedding 客户端
 *
 * 用原生 fetch，不锁死任何厂商 SDK。
 * 兼容任何 OpenAI Chat Completions / Embeddings 格式的端点：
 * - OpenAI 官方：https://api.openai.com/v1
 * - OpenRouter：https://openrouter.ai/api/v1（可调 Claude/GPT/Llama 等任意模型）
 * - DeepSeek / Moonshot / 本地 Ollama 等
 *
 * 只需配 AI_API_URL + AI_API_KEY + AI_MODEL。
 */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  messages: ChatMessage[];
  /** 是否流式（SSE） */
  stream?: boolean;
  /** 温度 0-1，教育场景建议低 */
  temperature?: number;
  /** 单次回复 token 上限 */
  maxTokens?: number;
}

const API_URL = process.env.AI_API_URL || "";
const API_KEY = process.env.AI_API_KEY || "";
const MODEL = process.env.AI_MODEL || "gpt-4o-mini";

/**
 * 调用 Chat Completions，返回流式 ReadableStream（SSE 解析后逐 token yield）。
 * 兼容 OpenAI 格式的 data: {json}\n\n 流。
 */
export async function streamChat(
  opts: ChatOptions,
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();

  const res = await fetch(`${API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: opts.messages,
      stream: true,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 1500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API ${res.status}: ${err.substring(0, 200)}`);
  }
  if (!res.body) throw new Error("AI API 无响应流");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      const text = decoder.decode(value, { stream: true });
      // 解析 SSE：多行 data: {json}
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          controller.close();
          return;
        }
        try {
          const json = JSON.parse(data);
          const token = json.choices?.[0]?.delta?.content;
          if (token) controller.enqueue(encoder.encode(token));
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
 * 生成 embedding 向量（用于 RAG 检索和查询向量化）。
 * 返回 number[]（1536 维，text-embedding-3-small）。
 */
export async function embed(text: string): Promise<number[]> {
  const embedUrl = process.env.AI_EMBEDDING_URL || API_URL;
  const embedModel = process.env.AI_EMBEDDING_MODEL || "text-embedding-3-small";

  const res = await fetch(`${embedUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
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
