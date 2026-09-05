import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithTimeoutRetry, UpstreamTimeoutError } from "./http";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fetchWithTimeoutRetry（R7.5）", () => {
  it("正常响应直接返回", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));
    const res = await fetchWithTimeoutRetry("https://x", {}, { timeoutMs: 100 });
    expect(res.status).toBe(200);
  });

  it("超时抛 UpstreamTimeoutError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
      ),
    );
    await expect(
      fetchWithTimeoutRetry("https://x", {}, { timeoutMs: 20, retries: 0 }),
    ).rejects.toBeInstanceOf(UpstreamTimeoutError);
  });

  it("5xx 重试 1 次后成功", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchWithTimeoutRetry("https://x", {}, { retries: 1, retryDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("429/5xx 重试耗尽后返回最后一次响应", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchWithTimeoutRetry("https://x", {}, { retries: 2, retryDelayMs: 1 });
    expect(res.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("4xx（非 429）不重试直接返回", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchWithTimeoutRetry("https://x", {}, { retries: 3, retryDelayMs: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("网络错误重试后仍失败则抛原始错误", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("network down");
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchWithTimeoutRetry("https://x", {}, { retries: 1, retryDelayMs: 1 }),
    ).rejects.toThrow("network down");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
