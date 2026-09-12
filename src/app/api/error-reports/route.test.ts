import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { parseErrorReportPayload, POST } from "./route";

function request(
  raw: string,
  contentType: string | null = "application/json",
  extraHeaders: Record<string, string> = {},
): NextRequest {
  const headers: Record<string, string> = { ...extraHeaders };
  if (contentType) headers["Content-Type"] = contentType;
  return new NextRequest("http://localhost/api/error-reports", {
    method: "POST",
    headers,
    body: raw,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseErrorReportPayload", () => {
  it("合法 fatal 载荷通过", () => {
    expect(parseErrorReportPayload({ level: "fatal", scope: "route-error", kind: "Error" })).toEqual({
      level: "fatal",
      scope: "route-error",
      kind: "Error",
    });
  });

  it("recoverable + digest 通过", () => {
    expect(
      parseErrorReportPayload({ level: "recoverable", scope: "ai-chat", kind: "TypeError", digest: "abc123" }),
    ).toEqual({ level: "recoverable", scope: "ai-chat", kind: "TypeError", digest: "abc123" });
  });

  it("未知字段整包拒绝（防止夹带 PII/自由文本）", () => {
    expect(
      parseErrorReportPayload({
        level: "fatal",
        scope: "route-error",
        kind: "Error",
        message: "user typed 13800138000",
      }),
    ).toBeNull();
    expect(
      parseErrorReportPayload({ level: "fatal", scope: "route-error", kind: "Error", url: "https://x/y" }),
    ).toBeNull();
  });

  it("level 只接受 fatal/recoverable，silent 与任意值拒绝", () => {
    expect(parseErrorReportPayload({ level: "silent", scope: "sync", kind: "Error" })).toBeNull();
    expect(parseErrorReportPayload({ level: "warn", scope: "sync", kind: "Error" })).toBeNull();
    expect(parseErrorReportPayload({ level: 1, scope: "sync", kind: "Error" })).toBeNull();
  });

  it("scope/kind 非法 token 或超长拒绝", () => {
    expect(parseErrorReportPayload({ level: "fatal", scope: "has space", kind: "Error" })).toBeNull();
    expect(parseErrorReportPayload({ level: "fatal", scope: "中文", kind: "Error" })).toBeNull();
    expect(parseErrorReportPayload({ level: "fatal", scope: "", kind: "Error" })).toBeNull();
    expect(
      parseErrorReportPayload({ level: "fatal", scope: "a".repeat(41), kind: "Error" }),
    ).toBeNull();
    expect(
      parseErrorReportPayload({ level: "fatal", scope: "route-error", kind: "k".repeat(41) }),
    ).toBeNull();
    expect(parseErrorReportPayload({ level: "fatal", scope: "route-error" })).toBeNull();
  });

  it("digest 可选；出现时必须合法且不超长", () => {
    expect(parseErrorReportPayload({ level: "fatal", scope: "route-error", kind: "Error", digest: undefined })).toEqual({
      level: "fatal",
      scope: "route-error",
      kind: "Error",
    });
    expect(
      parseErrorReportPayload({ level: "fatal", scope: "route-error", kind: "Error", digest: "d".repeat(65) }),
    ).toBeNull();
    expect(
      parseErrorReportPayload({ level: "fatal", scope: "route-error", kind: "Error", digest: "not a digest" }),
    ).toBeNull();
    expect(
      parseErrorReportPayload({ level: "fatal", scope: "route-error", kind: "Error", digest: 42 }),
    ).toBeNull();
  });

  it("非对象 / 数组 / null 拒绝", () => {
    expect(parseErrorReportPayload(null)).toBeNull();
    expect(parseErrorReportPayload([])).toBeNull();
    expect(parseErrorReportPayload("x")).toBeNull();
    expect(parseErrorReportPayload(undefined)).toBeNull();
  });
});

describe("POST /api/error-reports", () => {
  it("合法载荷返回 202 + no-store，并写 sanitized 日志", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const res = await POST(request(JSON.stringify({ level: "fatal", scope: "route-error", kind: "Error", digest: "abc123" })));
    expect(res.status).toBe(202);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(spy).toHaveBeenCalledWith("[error-report] fatal scope=route-error kind=Error digest=abc123");
  });

  it("无 digest 的日志不带 digest 段", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await POST(request(JSON.stringify({ level: "recoverable", scope: "ai-chat", kind: "TypeError" })));
    expect(spy).toHaveBeenCalledWith("[error-report] recoverable scope=ai-chat kind=TypeError");
  });

  it("畸形 JSON 返回 400", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const res = await POST(request("{不是 JSON"));
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it("非法载荷返回 400 且不写日志", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const res = await POST(request(JSON.stringify({ level: "silent", scope: "sync", kind: "Error" })));
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it("超大 body 返回 413", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const res = await POST(request(JSON.stringify({ level: "fatal", scope: "a".repeat(3000), kind: "Error" })));
    expect(res.status).toBe(413);
    expect(spy).not.toHaveBeenCalled();
  });

  it("非 application/json 返回 415", async () => {
    const res = await POST(request("level=fatal", "text/plain"));
    expect(res.status).toBe(415);
  });

  it("日志绝不包含原始 message / 用户内容", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const raw = JSON.stringify({
      level: "fatal",
      scope: "route-error",
      kind: "Error",
      message: "token=secret-13800138000",
    });
    const res = await POST(request(raw));
    expect(res.status).toBe(400); // 未知字段整包拒绝，根本不进入日志路径
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("POST /api/error-reports 限流（R7.12 / R7.6）", () => {
  it("同一 IP 超过每分钟配额返回 429 + Retry-After，不同 IP 不受牵连", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const raw = JSON.stringify({ level: "fatal", scope: "route-error", kind: "Error" });
    let last;
    for (let i = 0; i < 101; i++) {
      last = await POST(request(raw, "application/json", { "x-forwarded-for": "203.0.113.7" }));
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(last!.headers.get("cache-control")).toBeNull();

    // 另一个 IP 仍在其独立窗口内，不被前一个 IP 的配额拖累。
    const other = await POST(request(raw, "application/json", { "x-forwarded-for": "203.0.113.8" }));
    expect(other.status).toBe(202);
  });
});
