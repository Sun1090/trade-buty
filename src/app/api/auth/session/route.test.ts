import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthSessionMissingError } from "@supabase/supabase-js";

const getUser = vi.fn();
const createServerClient = vi.fn();

// 只替换第三方边界：GET 走真实的 getServerAuthUser，否则游客身份判定测不到。
vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => {
    createServerClient(...args);
    return { auth: { getUser } };
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [] as { name: string; value: string }[],
    setAll: () => {},
  }),
}));

import { GET } from "./route";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";

beforeEach(() => {
  vi.clearAllMocks();
  createServerClient.mockReturnValue({ auth: { getUser } });
});

describe("GET /api/auth/session", () => {
  it("无会话 cookie 的游客返回 user:null 而不是 500", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthSessionMissingError(),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
  });

  it("无登录用户时返回 user:null", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
  });

  it("登录用户返回 id/email", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
      error: null,
    });
    const res = await GET();
    expect(await res.json()).toEqual({ user: { id: "user-1", email: "a@b.com" } });
  });

  it("getUser 返回 error 时回退 user:null 且不回传内部错误", async () => {
    getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error("secret: trace expired"),
    });
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ user: null, error: "session error" });
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("客户端创建抛错时回退 user:null 且不回传内部错误", async () => {
    createServerClient.mockImplementationOnce(() => {
      throw new Error("invalid api key: secret");
    });
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ user: null, error: "session error" });
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});
