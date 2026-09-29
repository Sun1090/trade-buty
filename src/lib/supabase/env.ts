/**
 * R16.235：env 判断单独住进一个不依赖 supabase-js 的模块。
 * auth-provider / sync-layer 因自身职责会进入每条路由的首屏 chunk，
 * 它们只需要知道「云端是否配置」；静态 import 整个 client 模块会把
 * supabase-js（~59KB gzip）拖进 454 条路由。要客户端的调用点一律
 * 动态 `import("@/lib/supabase/client")`。
 */

/** R7.7：env 是否可用——CI E2E / 无 Supabase 预览环境降级判断 */
export function hasSupabaseEnv(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
