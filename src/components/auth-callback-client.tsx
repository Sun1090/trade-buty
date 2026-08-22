"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { hydrateFromCloud } from "@/lib/sync-layer";

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // @supabase/ssr：魔法链接回调的 hash 由 client 自动交换
      // 尝试直接读当前会话（signInWithOtp 邮件跳回时已带 token）
      const { data: cur } = await getSupabaseBrowser().auth.getSession();
      const session = cur.session;
      if (cancelled) return;
      if (session?.user) {
        setState("success");
        // 登录合并：从云端拉取并合并进本地
        try {
          await hydrateFromCloud(session.user.id);
        } catch {
          // 合并失败不阻断跳转，本地数据仍在
        }
        setTimeout(() => router.push(`/${locale}`), 800);
      } else {
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, locale]);

  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      {state === "error" ? (
        <p className="text-down text-sm">{dict.callbackError}</p>
      ) : (
        <p className="text-sm text-muted">
          {state === "success" ? dict.callbackSuccess : dict.callbackProcessing}
        </p>
      )}
    </div>
  );
}
