import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { readBoundedBody, readJsonBody } from "./request-body";

function request(body: string): NextRequest {
  return new NextRequest("http://localhost/api/anything", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("readBoundedBody", () => {
  it("上限之内原样交出正文", async () => {
    expect(await readBoundedBody(request('{"a":1}'), 4_096)).toBe('{"a":1}');
  });

  it("按字节而不是字符计数：CJK 一个字最多 3 字节", async () => {
    const text = "损".repeat(10); // 30 字节
    expect(await readBoundedBody(request(text), 30)).toBe(text);
    expect(await readBoundedBody(request(text), 29)).toBeNull();
  });

  it("超过上限返回 null，并把还在供流的请求体取消掉", async () => {
    let cancelled = 0;
    // 首块就超限、且永不 close：这样 cancel 一定传导到底层源
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(500)));
      },
      cancel() {
        cancelled += 1;
      },
    });
    const req = { body: stream } as unknown as NextRequest;
    expect(await readBoundedBody(req, 100)).toBeNull();
    expect(cancelled).toBe(1);
  });

  it("没有请求体时交出空串（由解析层判成非法 JSON）", async () => {
    const req = new NextRequest("http://localhost/api/anything", { method: "POST" });
    expect(await readBoundedBody(req, 100)).toBe("");
  });

  it("读取中途抛错按 null 处理，不把异常抛给路由", async () => {
    const broken = () =>
      ({
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("{}"));
            controller.error(new Error("connection reset"));
          },
        }),
      }) as unknown as NextRequest;
    expect(await readBoundedBody(broken(), 100)).toBeNull();
    expect(await readJsonBody(broken(), 100)).toEqual({ ok: false, reason: "too-large" });
  });
});

describe("readJsonBody", () => {
  it("合法 JSON 走 ok 分支", async () => {
    const res = await readJsonBody(request('{"rating":"helpful"}'), 1_024);
    expect(res).toEqual({ ok: true, value: { rating: "helpful" } });
  });

  it("非法 JSON 与空 body 都是 invalid，不是 too-large", async () => {
    expect(await readJsonBody(request("{ not json"), 1_024)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(await readJsonBody(request(""), 1_024)).toEqual({ ok: false, reason: "invalid" });
  });

  it("超限优先于解析：body 大到一半也能立刻判 too-large 而不是先解析", async () => {
    const res = await readJsonBody(request('{"a":"' + "y".repeat(9_000) + '"}'), 512);
    expect(res).toEqual({ ok: false, reason: "too-large" });
  });
});
