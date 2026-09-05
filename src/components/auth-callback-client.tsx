"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
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
  const [state, setState] = useState<"processing" | "success" | "error">(
    "processing",
  );
  const searchParams = useSearchParams();
  const rawReturn = searchParams?.get("returnTo");
  const returnTo = normalizeReturnTo(rawReturn, locale);

  useEffect(() => {
    let settled = false;
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
        setTimeout(navigateAway, 800);
      }
    });

    const { data: sub } = client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (settled) return;
      if (event === "SIGNED_IN" && session?.user) {
        settled = true;
        clearTimeout(failTimer);
        setState("success");
        // hydrate 交给 AuthProvider 的 onAuthStateChange
        setTimeout(navigateAway, 800);
      }
    });

    return () => {
      settled = true;
      clearTimeout(failTimer);
      sub.subscription.unsubscribe();
    };
  }, [router, locale, returnTo]);

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
