import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const signOut = vi.fn();
const createClient = vi.fn(async () => ({ auth: { signOut } }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createClient(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/signout", () => {
  it("正常登出返回 ok", async () => {
    signOut.mockResolvedValue({ error: null });
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("登出抛错时返回通用文案，不回传内部错误", async () => {
    signOut.mockRejectedValueOnce(new Error("auth server 500 trace"));
    const res = await POST();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "signout error" });
    expect(JSON.stringify(body)).not.toContain("trace");
  });
});
