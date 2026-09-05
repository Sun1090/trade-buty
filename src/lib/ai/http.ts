/**
 * R7.5：AI 上游请求统一超时与重试封装。
 * - 超时：AbortController，默认 30s（LLM 首包一般 <10s，embed 更快）
 * - 重试：仅幂等安全场景（连接失败/超时/429/5xx），默认 1 次退避 1s
 * - 流式请求（streamChat）超时只约束到响应头到达，正文流式不受限
 */

export interface FetchTimeoutOptions {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export class UpstreamTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`upstream timeout after ${timeoutMs}ms`);
    this.name = "UpstreamTimeoutError";
  }
}

/** 判断该响应是否值得重试（429/5xx） */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function fetchWithTimeoutRetry(
  url: string,
  init: RequestInit,
  opts: FetchTimeoutOptions = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const retries = opts.retries ?? 1;
  const retryDelayMs = opts.retryDelayMs ?? 1_000;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (isRetryableStatus(res.status) && attempt < retries) {
        lastError = new Error(`retryable status ${res.status}`);
        continue;
      }
      return res;
    } catch (e) {
      // 网络失败/超时 → 记住错误，若还有重试次数则继续
      lastError = e;
      if (attempt >= retries) {
        if (e instanceof Error && e.name === "AbortError") {
          throw new UpstreamTimeoutError(timeoutMs);
        }
        throw e;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("upstream request failed");
}
