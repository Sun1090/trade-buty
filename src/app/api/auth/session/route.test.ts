import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const getUser = vi.fn();
const createClient = vi.fn(async () => ({ auth: { getUser } }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createClient(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/auth/session", () => {
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

  it("查询抛错时回退 user:null 且不回传内部错误", async () => {
    createClient.mockRejectedValueOnce(new Error("invalid api key: secret"));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.user).toBeNull();
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});
