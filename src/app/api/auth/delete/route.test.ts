import { describe, it, expect, beforeEach, vi } from "vitest";
import { DELETE } from "./route";

const getUser = vi.fn();
const signOut = vi.fn();
const deleteUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser, signOut } })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({ auth: { admin: { deleteUser } } })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  deleteUser.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({ error: null });
});

describe("DELETE /api/auth/delete (R9.10)", () => {
  it("rejects unauthenticated requests", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await DELETE();
    expect(res.status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("rejects auth lookup errors", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("expired") });
    const res = await DELETE();
    expect(res.status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("returns 503 when service configuration is unavailable", async () => {
    const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const res = await DELETE();
      expect(res.status).toBe(503);
      expect(getUser).not.toHaveBeenCalled();
    } finally {
      process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
    }
  });

  it("deletes exactly the authenticated user and signs out", async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(deleteUser).toHaveBeenCalledWith("user-1");
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("does not report success when admin deletion fails", async () => {
    deleteUser.mockResolvedValueOnce({ error: new Error("RLS") });
    const res = await DELETE();
    expect(res.status).toBe(502);
    expect(signOut).not.toHaveBeenCalled();
  });
});
