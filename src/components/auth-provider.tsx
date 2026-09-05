"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getSupabaseBrowser, hasSupabaseEnv } from "@/lib/supabase/client";
import { setAuthState } from "@/lib/sync-layer";
// hydrateFromCloud 单独动态引入——避免把 sync-queue-store 通过 sync-layer 拉进 layout chunk
// （R9.6 体积守门：登录/同步逻辑仅登录后才需要）
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";

interface AuthUser {
  id: string;
  email: string | null;
}

const AuthContext = createContext<AuthUser | null>(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // 记住已 hydrate 过的 userId，避免重复拉取云端数据
  const hydratedRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    // R7.7：无 Supabase env（CI E2E / 预览环境）时降级为纯本地模式，不初始化客户端
    if (!hasSupabaseEnv()) {
      setAuthState(false);
      return;
    }
    const client = getSupabaseBrowser();

    // @supabase/ssr 的 createBrowserClient 默认 detectSessionInUrl=true + flowType=pkce：
    // 构造时会自动检测 URL 里的 ?code=（PKCE）或 #access_token=（implicit），
    // 用 storage 里的 code_verifier 交换 session，并自动清掉 URL 参数。
    // 这里只需挂载后读会话 + 监听变化。

    // R9.5：flush 离线写队列——只在登录后 / 网络恢复时按需引入 sync-queue-store 与 executor，
    // 避免它们被打进 layout 的共享 chunk（否则每个页面 +24KB）。
    async function flushQueueAfterLogin(uid: string): Promise<void> {
      try {
        const [{ flushPersistedQueue }, { buildQueueExecutor }] = await Promise.all([
          import("@/lib/sync-queue-store"),
          import("@/lib/sync-queue-executor"),
        ]);
        await flushPersistedQueue(buildQueueExecutor(uid));
      } catch {
        // best-effort；下一轮 online/SIGNED_IN 还会重试
      }
    }

    client.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (!mounted) return;
      const u = session?.user;
      if (u) {
        setUser({ id: u.id, email: u.email ?? null });
        setAuthState(true, u.id);
        // 页面刷新后已有会话：补一次 hydrate（若未做过）；完成后 flush 离线写队列
        if (hydratedRef.current !== u.id) {
          hydratedRef.current = u.id;
          void import("@/lib/sync-layer").then(({ hydrateFromCloud }) => hydrateFromCloud(u.id)).then(() => {
            void flushQueueAfterLogin(u.id);
          });
        }
      }
    });

    const { data: sub } = client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      const u = session?.user;
      if (u) {
        setUser({ id: u.id, email: u.email ?? null });
        setAuthState(true, u.id);
        // 新登录：触发云端合并（用 ref 去重，避免与 getSession 的 hydrate 重复）
        if (event === "SIGNED_IN" && hydratedRef.current !== u.id) {
          hydratedRef.current = u.id;
          void import("@/lib/sync-layer").then(({ hydrateFromCloud }) => hydrateFromCloud(u.id)).then(() => {
            void flushQueueAfterLogin(u.id);
          });
        }
      } else {
        setUser(null);
        setAuthState(false);
        hydratedRef.current = null;
      }
    });

    // R9.5：网络恢复时尝试 flush 离线写队列（仅登录态有效）
    const onOnline = () => {
      const uid = hydratedRef.current;
      if (!uid) return;
      void flushQueueAfterLogin(uid);
    };
    window.addEventListener("online", onOnline);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}
