import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(
    (url: string, key: string, options: Record<string, unknown>) => ({
      url,
      key,
      options,
    }),
  ),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

import { createSupabaseAdminClient } from "./admin";

const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

afterEach(() => {
  mocks.createClient.mockClear();
  if (ORIGINAL_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
  if (ORIGINAL_SERVICE === undefined)
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_SERVICE;
});

describe("createSupabaseAdminClient", () => {
  it("uses the service role key and disables session persistence", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const client = createSupabaseAdminClient() as unknown as {
      url: string;
      key: string;
      options: { auth: { persistSession: boolean; autoRefreshToken: boolean } };
    };

    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://proj.supabase.co",
      "service-role-key",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    expect(client.key).toBe("service-role-key");
    expect(client.options.auth).toEqual({
      persistSession: false,
      autoRefreshToken: false,
    });
  });
});
