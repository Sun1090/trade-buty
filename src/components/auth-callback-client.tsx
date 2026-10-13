"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { normalizeReturnTo } from "@/lib/auth-return";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

type AuthDict = {
  callbackProcessing: string;
  callbackSuccess: string;
  callbackError: string;
};

export function AuthCallbackClient({
  dict,
  locale,
}: {
  dict: AuthDict;
  locale: string;
}) {
  const router = useRouter();
  // R16.334：云端没配就直接落在这一页自己写好的失败态。
  // 这一问**必须在初始 state 里**而不是 effect 里：effect 里同步 setState 会触发级联渲染
  // （eslint react-hooks 判红），而 `NEXT_PUBLIC_*` 是构建时内联的字面量，SSR 与水合读到同一个值，
  // 放在初始 state 里不会造成水合不匹配——这一页正是水合巡检（runtime-health）覆盖的对象。
  const cloudConfigured = hasSupabaseEnv();
  const [state, setState] = useState<"processing" | "success" | "error">(
    cloudConfigured ? "processing" : "error",
  );
  const searchParams = useSearchParams();
  const rawReturn = searchParams?.get("returnTo");
  const returnTo = normalizeReturnTo(rawReturn, locale);

  useEffect(() => {
    let settled = false;
    let navigateTimer: ReturnType<typeof setTimeout> | null = null;
    // 这一页此前**裸调** `getSupabaseBrowser()`——它在缺 Supabase env 时直接抛，整个 effect 抛出、
    // Next 记成 `[err:fatal] route-error`，用户看到的是整站错误页，而不是这一页本来就写好的失败提示。
    // CI 的 `e2e` job 恰好跑在没有 Supabase env 的环境里（带 env 的是 `auth-e2e`），所以这条红只在 CI 存在。
    // 问的是与那道会抛的门**同一个**谓词（R16.215 的规矩），`login-client.tsx` 早就这么做。
    if (!cloudConfigured) return;
    const client = getSupabaseBrowser();

    // createBrowserClient 构造时 detectSessionInUrl 已自动交换 URL 里的 code/token。
    // 监听 SIGNED_IN 确认成功；若已有 session（刷新页面）直接成功。
    // 兜底超时：4 秒后没拿到 session 视为失败（链接过期等）
    const failTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setState("error");
      }
    }, 4000);

    const navigateAway = () => {
      // R9.1：跳回原页（returnTo），未指定时回首页
      router.push(returnTo ?? `/${locale}`);
    };

    client.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (settled) return;
      if (session?.user) {
        settled = true;
        clearTimeout(failTimer);
        setState("success");
        navigateTimer = setTimeout(navigateAway, 800);
      }
    });

    const { data: sub } = client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (settled) return;
      if (event === "SIGNED_IN" && session?.user) {
        settled = true;
        clearTimeout(failTimer);
        setState("success");
        // hydrate 交给 AuthProvider 的 onAuthStateChange
        navigateTimer = setTimeout(navigateAway, 800);
      }
    });

    return () => {
      settled = true;
      clearTimeout(failTimer);
      if (navigateTimer) clearTimeout(navigateTimer);
      sub.subscription.unsubscribe();
    };
  }, [router, locale, returnTo, cloudConfigured]);

  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      {state === "error" ? (
        <p className="text-down text-sm">{dict.callbackError}</p>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {state === "processing" && (
            <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
          )}
          <p className="text-sm text-muted">
            {state === "success" ? dict.callbackSuccess : dict.callbackProcessing}
          </p>
        </div>
      )}
    </div>
  );
}
