import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, parseExportQuery } from "./route";

const from = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ from })),
}));

type QueryResult = { data: unknown[] | null; error: { message: string } | null };
let result: QueryResult = { data: [], error: null };
const eq = vi.fn();
const gte = vi.fn();
const limit = vi.fn();
function builder(): Record<string, unknown> {
  const self: Record<string, unknown> = {};
  const chain = () => self;
  self.select = vi.fn(chain);
  self.order = vi.fn(chain);
  self.limit = vi.fn(() => {
    limit();
    return self;
  });
  self.eq = vi.fn((...args: unknown[]) => {
    eq(...args);
    return self;
  });
  self.gte = vi.fn((...args: unknown[]) => {
    gte(...args);
    return self;
  });
  self.then = (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return self;
}

function request(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/ai/feedback/export", { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  result = { data: [], error: null };
  process.env.ADMIN_TOKEN = "secret";
  from.mockImplementation(() => builder());
});

afterEach(() => {
  delete process.env.ADMIN_TOKEN;
});

describe("parseExportQuery", () => {
  it("默认值：limit 100，无过滤", () => {
    expect(parseExportQuery(new URLSearchParams())).toEqual({
      rating: undefined,
      limit: 100,
      since: undefined,
    });
  });

  it("合法参数透传", () => {
    const q = parseExportQuery(
      new URLSearchParams("rating=unhelpful&limit=20&since=2026-01-01")
    );
    expect(q).toEqual({ rating: "unhelpful", limit: 20, since: "2026-01-01" });
  });

  it("非法 rating 被丢弃", () => {
    expect(parseExportQuery(new URLSearchParams("rating=meh")).rating).toBeUndefined();
  });

  it("limit 上限 500，下限回退 100", () => {
    expect(parseExportQuery(new URLSearchParams("limit=9999")).limit).toBe(500);
    expect(parseExportQuery(new URLSearchParams("limit=-3")).limit).toBe(100);
    expect(parseExportQuery(new URLSearchParams("limit=abc")).limit).toBe(100);
  });

  it("非法日期被丢弃", () => {
    expect(parseExportQuery(new URLSearchParams("since=not-a-date")).since).toBeUndefined();
  });
});

describe("GET /api/ai/feedback/export", () => {
  it("缺少或错误 token 返回 401 且不访问数据库", async () => {
    const noHeader = await GET(request());
    expect(noHeader.status).toBe(401);
    const wrong = await GET(request({ authorization: "Bearer nope" }));
    expect(wrong.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("无 ADMIN_TOKEN 配置时一律 401", async () => {
    delete process.env.ADMIN_TOKEN;
    const res = await GET(request({ authorization: "Bearer secret" }));
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("合法 token 透传 rating/since 过滤并返回 count", async () => {
    result = { data: [{ id: 1 }, { id: 2 }], error: null };
    const res = await GET(
      request({ authorization: "Bearer secret" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.items).toHaveLength(2);
  });

  it("数据库失败返回通用文案，不回传内部错误", async () => {
    result = { data: null, error: { message: "relation ai_feedback does not exist" } };
    const res = await GET(request({ authorization: "Bearer secret" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to export feedback");
    expect(JSON.stringify(body)).not.toContain("relation");
  });
});
