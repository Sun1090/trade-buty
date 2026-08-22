import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 浏览器客户端（anon key，守 RLS）—— 双写层和登录 UI 用
 * 懒初始化：模块顶层不求值，避免 prerender 阶段 env 缺失时抛错。
 * 调用 getSupabaseBrowser() 时才真正创建（仅发生在浏览器运行时）。
 */
let cached: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (cached) return cached;
  cached = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return cached;
}
