import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { parseCitationClick, POST } from "./route";

const getUser = vi.fn();
const insert = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser }, from: () => ({ insert }) })),
}));

function request(raw: string): NextRequest {
  return new NextRequest("http://localhost/api/ai/citation-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  insert.mockResolvedValue({ error: null });
});

describe("parseCitationClick", () => {
  it("合法 source 点击返回规范化字段", () => {
    const out = parseCitationClick({
      kind: "source",
      chapter: "spot",
      doc: "order-types",
      question: "什么是市价单？",
    });
    expect(out).toEqual({
      kind: "source",
      chapter: "spot",
      doc: "order-types",
      question: "什么是市价单？",
    });
  });

  it("suggested 点击无 doc 也合法", () => {
    expect(parseCitationClick({ kind: "suggested", chapter: "futures" })).toEqual({
      kind: "suggested",
      chapter: "futures",
      doc: undefined,
      question: undefined,
    });
  });

  it("非法 kind / 空 chapter / 非对象返回 null", () => {
    expect(parseCitationClick({ kind: "click", chapter: "spot" })).toBeNull();
    expect(parseCitationClick({ kind: "source", chapter: "  " })).toBeNull();
    expect(parseCitationClick(null)).toBeNull();
    expect(parseCitationClick("x")).toBeNull();
  });

  it("chapter 超长拒绝；doc/question 超长截断", () => {
    expect(parseCitationClick({ kind: "source", chapter: "a".repeat(101) })).toBeNull();
    const out = parseCitationClick({
      kind: "source",
      chapter: "spot",
      doc: "d".repeat(300),
      question: "q".repeat(600),
    });
    expect(out?.doc).toHaveLength(200);
    expect(out?.question).toHaveLength(500);
  });
});

describe("POST /api/ai/citation-click", () => {
  it("畸形 JSON 返回 400 且不写库", async () => {
    const res = await POST(request("{不是 JSON"));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("非法载荷返回 400", async () => {
    const res = await POST(request(JSON.stringify({ kind: "click", chapter: "spot" })));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("合法匿名点击写入成功，user_id 为 null", async () => {
    const res = await POST(request(JSON.stringify({ kind: "source", chapter: "spot", doc: "order-types" })));
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith({
      user_id: null,
      kind: "source",
      chapter: "spot",
      doc: "order-types",
      question: null,
    });
  });

  it("数据库失败返回通用文案，不回传内部错误", async () => {
    insert.mockResolvedValue({ error: { message: "permission denied for table ai_citation_clicks" } });
    const res = await POST(request(JSON.stringify({ kind: "source", chapter: "spot" })));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to record click");
    expect(JSON.stringify(body)).not.toContain("permission denied");
  });
});
