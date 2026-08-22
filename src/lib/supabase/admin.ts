import { createClient } from "@supabase/supabase-js";

/**
 * service_role 客户端（绕过 RLS）—— **仅 src/app/api/** 导入**
 * 绝不进客户端代码；用于服务端批量操作
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
