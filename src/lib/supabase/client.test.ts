import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createBrowserClient: vi.fn((url: string, key: string) => ({
    __client: true,
    url,
    key,
  })),
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: mocks.createBrowserClient,
}));

const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function restoreEnv() {
  if (ORIGINAL_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
  if (ORIGINAL_KEY === undefined)
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_KEY;
}

beforeEach(() => {
  mocks.createBrowserClient.mockClear();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  vi.resetModules();
});

afterEach(() => {
  restoreEnv();
  vi.resetModules();
});

async function load() {
  return import("./client");
}

describe("hasSupabaseEnv（R7.7）", () => {
  it("is false when either variable is missing", async () => {
    const { hasSupabaseEnv } = await load();
    expect(hasSupabaseEnv()).toBe(false);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    expect(hasSupabaseEnv()).toBe(false);
  });

  it("is true when url and anon key are both present", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    const { hasSupabaseEnv } = await load();
    expect(hasSupabaseEnv()).toBe(true);
  });
});

describe("getSupabaseBrowser", () => {
  it("throws a guard-rail error instead of constructing without env", async () => {
    const { getSupabaseBrowser } = await load();
    expect(() => getSupabaseBrowser()).toThrow(/Supabase env missing/);
    expect(mocks.createBrowserClient).not.toHaveBeenCalled();
  });

  it("constructs the browser client from the public env", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    const { getSupabaseBrowser } = await load();
    const client = getSupabaseBrowser() as unknown as { url: string; key: string };
    expect(client.url).toBe("https://proj.supabase.co");
    expect(client.key).toBe("anon");
    expect(mocks.createBrowserClient).toHaveBeenCalledTimes(1);
  });

  it("caches the client across calls", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    const { getSupabaseBrowser } = await load();
    expect(getSupabaseBrowser()).toBe(getSupabaseBrowser());
    expect(mocks.createBrowserClient).toHaveBeenCalledTimes(1);
  });
});
