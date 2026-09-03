import { describe, expect, it } from "vitest";
import {
  hasSupabaseEnv,
  supabaseAnonKey,
  supabaseServiceKey,
  supabaseUrl,
} from "./supabase-env";

describe("supabase-env", () => {
  it("缺变量时 hasSupabaseEnv 为 false 且取值抛明确错误", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(hasSupabaseEnv()).toBe(false);
    expect(() => supabaseUrl()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => supabaseAnonKey()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    expect(() => supabaseServiceKey()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("变量齐全时取值正常", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    expect(hasSupabaseEnv()).toBe(true);
    expect(supabaseUrl()).toBe("https://x.supabase.co");
    expect(supabaseAnonKey()).toBe("anon");
    // node 环境无 window，可取 service key（浏览器端另有运行时守卫）
    expect(supabaseServiceKey()).toBe("service");
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });
});
