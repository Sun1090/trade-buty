import type { NextRequest } from "next/server";

/**
 * 请求体读取的唯一入口：先按字节上限取流，再解析。
 *
 * 为什么不能直接 `req.json()`：字段级校验（各路由的 `parse*Body`）是在**整个 body
 * 已经被缓冲并解析成对象之后**才跑的，所以「单条消息最多 8000 字符」这类上限挡不住
 * 一个几百 MB 的请求体——未鉴权的路由等于把内存放大交给客户端决定。这里把上限放在
 * 读流阶段：超了立刻 `cancel()` 断流，缓冲区永远不会长成那个大小。
 */

/** 有界读取请求体；超过上限返回 null（调用方回 413）。 */
export async function readBoundedBody(
  req: NextRequest,
  maxBytes: number,
): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch {
    return null;
  }
}

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "too-large" | "invalid" };

/** 读取并解析 JSON 请求体；超限 too-large、不是合法 JSON（含空 body）invalid。 */
export async function readJsonBody(
  req: NextRequest,
  maxBytes: number,
): Promise<JsonBodyResult> {
  const raw = await readBoundedBody(req, maxBytes);
  if (raw === null) return { ok: false, reason: "too-large" };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
