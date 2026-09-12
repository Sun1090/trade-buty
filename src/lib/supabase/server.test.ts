import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

import { createSupabaseServerClient } from "./server";

type CookieAdapter = {
  getAll: () => { name: string; value: string }[];
  setAll: (
    items: { name: string; value: string; options?: Record<string, unknown> }[],
  ) => void;
};

let store: {
  getAll: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  mocks.cookies.mockReset();
  mocks.createServerClient.mockReset();
  store = {
    getAll: vi.fn(() => [{ name: "sb-token", value: "abc" }]),
    set: vi.fn(),
  };
  mocks.cookies.mockResolvedValue(store);
  mocks.createServerClient.mockReturnValue({ __client: true });
});

async function loadAdapter(): Promise<CookieAdapter> {
  await createSupabaseServerClient();
  const call = mocks.createServerClient.mock.calls[0] as unknown as [
    string,
    string,
    { cookies: CookieAdapter },
  ];
  return call[2].cookies;
}

describe("createSupabaseServerClient", () => {
  it("passes the public env to createServerClient", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    await createSupabaseServerClient();
    expect(mocks.createServerClient).toHaveBeenCalledWith(
      "https://proj.supabase.co",
      "anon",
      expect.objectContaining({ cookies: expect.any(Object) }),
    );
  });

  it("reads request cookies through getAll", async () => {
    const adapter = await loadAdapter();
    expect(adapter.getAll()).toEqual([{ name: "sb-token", value: "abc" }]);
  });

  it("writes refreshed cookies back to the store", async () => {
    const adapter = await loadAdapter();
    adapter.setAll([{ name: "sb-token", value: "next" }]);
    expect(store.set).toHaveBeenCalledWith("sb-token", "next", undefined);
  });

  it("ignores writes when called from a read-only server component", async () => {
    const adapter = await loadAdapter();
    store.set.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action");
    });
    expect(() => adapter.setAll([{ name: "sb-token", value: "next" }])).not.toThrow();
  });
});
