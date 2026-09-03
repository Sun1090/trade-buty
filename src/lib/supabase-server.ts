import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  supabaseAnonKey,
  supabaseServiceKey,
  supabaseUrl,
} from "./supabase-env";

/** Server Component / Route Handler 用的会话客户端（走用户 cookie） */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component 只读场景下 set 会抛错，属于预期内，忽略
        }
      },
    },
  });
}

/**
 * 管理员客户端（service_role，绕过 RLS）。
 * 仅限服务端 route handler 内部使用，且必须先自行校验用户身份。
 */
export function createServiceSupabaseClient() {
  return createAdminClient(supabaseUrl(), supabaseServiceKey());
}
