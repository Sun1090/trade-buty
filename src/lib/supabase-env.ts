/** Supabase 环境变量：缺失时构建期/运行期明确报错，绝不静默失败 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[supabase] 缺少环境变量 ${name}。本地请写入 .env.local；线上请配 Vercel → Project Settings → Environment Variables。`
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL");
}

export function supabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

/** 仅服务端可用：调用处若在浏览器会抛错，防止 service_role 泄漏进客户端 bundle */
export function supabaseServiceKey(): string {
  if (typeof window !== "undefined") {
    throw new Error(
      "[supabase] service_role key 禁止在浏览器端使用。请改走服务端 API route。"
    );
  }
  return required("SUPABASE_SERVICE_ROLE_KEY");
}

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
