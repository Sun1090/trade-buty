import { NextRequest, NextResponse } from "next/server";
import { clientIp, createRateLimiter } from "@/lib/ai/rate-limit";
import {
  ERROR_REPORT_ALLOWED_KEYS,
  MAX_DIGEST_LENGTH,
  MAX_ERROR_REPORT_BYTES,
  MAX_KIND_LENGTH,
  MAX_SCOPE_LENGTH,
  isSafeReportToken,
  type ErrorReportPayload,
} from "@/lib/error-report";

/**
 * R7.6：统一的前端错误上报端点。
 *
 * 这是全站唯一接收崩溃/可恢复错误诊断的入口，长期未接入时有真实缺口：
 * 客户端 `reportError` 只写本机 console，服务端看不到任何崩溃信号。
 *
 * 隐私边界（与 src/lib/error-report.ts 的客户端白名单一一对应）：
 * - 只接受 level/scope/kind/digest 四个字段，未知字段整包拒绝；
 * - scope/kind/digest 必须是限长安全 token，无法承载自由文本；
 * - 不接受（也从不读取）错误 message、stack、页面 URL、账号或用户身份；
 * - 服务端只把 sanitized 字段写入结构化日志，不落库、不回显请求体。
 */

const WINDOW_MS = 60_000;
/** 每个 IP 每分钟上限：足以容纳一个坏页面的重复崩溃，又挡得住日志洪泛。 */
const PER_MINUTE_LIMIT = 100;

const errorReportLimiter = createRateLimiter({
  // 端点匿名可用，没有登录态区分；两个配额取同一值。
  guestLimit: PER_MINUTE_LIMIT,
  authedLimit: PER_MINUTE_LIMIT,
  windowMs: WINDOW_MS,
});

/**
 * 严格解析并重建白名单载荷；任何越界都返回 null（调用方回 400）。
 * 导出便于单测。
 */
export function parseErrorReportPayload(value: unknown): ErrorReportPayload | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;

  // 未知字段整包拒绝：即便攻击者想夹带 PII，也不会被记录或透传。
  for (const key of Object.keys(record)) {
    if (!(ERROR_REPORT_ALLOWED_KEYS as readonly string[]).includes(key)) return null;
  }

  const level = record.level;
  if (level !== "fatal" && level !== "recoverable") return null;
  if (!isSafeReportToken(record.scope, MAX_SCOPE_LENGTH)) return null;
  if (!isSafeReportToken(record.kind, MAX_KIND_LENGTH)) return null;

  let digest: string | undefined;
  if (record.digest !== undefined) {
    if (!isSafeReportToken(record.digest, MAX_DIGEST_LENGTH)) return null;
    digest = record.digest;
  }

  return { level, scope: record.scope, kind: record.kind, ...(digest ? { digest } : {}) };
}

/** 有界读取请求体：超过上限立即断流并返回 null，避免超大 body 撑爆实例内存。 */
async function readBoundedBody(req: NextRequest, maxBytes: number): Promise<string | null> {
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

/** POST：接收匿名、无身份的诊断信号；成功与主动丢弃都返回 202，不泄露内部状态。 */
export async function POST(req: NextRequest) {
  const decision = errorReportLimiter.check(clientIp(req), false);
  if (!decision.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(decision.retryAfterSec) } },
    );
  }

  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Unsupported media type" }, { status: 415 });
  }

  const raw = await readBoundedBody(req, MAX_ERROR_REPORT_BYTES);
  if (raw === null) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = parseErrorReportPayload(parsed);
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // 只输出 sanitized 字段；错误正文从未到达这里，因此也不会进入日志。
  console.info(
    `[error-report] ${payload.level} scope=${payload.scope} kind=${payload.kind}` +
      (payload.digest ? ` digest=${payload.digest}` : ""),
  );

  return NextResponse.json(
    { ok: true },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
