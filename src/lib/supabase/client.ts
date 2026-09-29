import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv } from "./env";

/**
 * 浏览器客户端（anon key，守 RLS）—— 双写层和登录 UI 用
 * 懒初始化：模块顶层不求值，避免 prerender 阶段 env 缺失时抛错。
 * 调用 getSupabaseBrowser() 时才真正创建（仅发生在浏览器运行时）。
 *
 * R16.235：本模块会静态依赖 supabase-js，因此只允许被动态 import——
 * auth-provider / sync-layer 等首屏模块用 hasSupabaseEnv()（@/lib/supabase/env）
 * 做降级判断，等真的需要客户端时才把这一块拉下来。
 */
let cached: SupabaseClient | null = null;

export { hasSupabaseEnv };

export function getSupabaseBrowser(): SupabaseClient {
  if (!hasSupabaseEnv()) {
    throw new Error("Supabase env missing — guard with hasSupabaseEnv() before calling");
  }
  if (cached) return cached;
  cached = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return cached;
}
