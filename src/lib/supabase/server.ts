import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * SSR cookie 客户端（anon key，守 RLS）
 * Server Component / API route 读会话用；不可用于服务端写数据
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component 调用时无法 set cookie（只读），忽略
          }
        },
      },
    },
  );
}
