"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getSupabaseBrowser, hasSupabaseEnv } from "@/lib/supabase/client";
import { setAuthState } from "@/lib/sync-layer";
// 离线期间没能落盘的写入（队列 chunk 当时加载不了）缓冲在 sync-layer 的入队模块里，
// 它已随 sync-layer 进入 layout chunk，这里静态引入不再额外拉体积。
import { retryBufferedWrites } from "@/lib/sync-layer-queue-fallback";
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

    // R9.8：记录当前访问 + 检测 7 天未访是否需要温和提示
    // 同步逻辑纯函数 + sessionStorage 去重（toast 内已处理），不会每次都弹
    void import("@/lib/last-visit").then(({ touchLastVisit, getLastVisitAt, shouldShowReturnNudge }) => {
      const now = Date.now();
      const previousVisit = getLastVisitAt();
      // 先用旧访问时间判断，再写入本次访问；否则每次都会把间隔清零。
      const shouldNudge = previousVisit !== null && shouldShowReturnNudge(now, previousVisit);
      touchLastVisit(now);
      if (shouldNudge) {
        // lazy toast 可能尚未完成加载，用 pending 标记避免事件被错过。
        try { window.sessionStorage.setItem("tb-return-nudge-pending", "1"); } catch { /* ignore */ }
        const days = Math.max(1, Math.floor((now - previousVisit) / (24 * 60 * 60 * 1000)));
        window.dispatchEvent(new CustomEvent("tb-return-nudge", { detail: { days } }));
      }
    }).catch(() => {});

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
        // 先把离线期间留在内存缓冲里的写入落盘（那时队列 chunk 加载不了），
        // 再重放——否则这一轮 flush 看不见它们，要等下一次失败的写入才被顺带带出来。
        await retryBufferedWrites();
        const [{ flushPersistedQueue }, { buildQueueExecutor }] = await Promise.all([
          import("@/lib/sync-queue-store"),
          import("@/lib/sync-queue-executor"),
        ]);
        await flushPersistedQueue(buildQueueExecutor(uid), uid);
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
        // 链尾的 catch 不是装饰：离线时这些动态 import 会 reject，而链是 fire-and-forget。
        if (hydratedRef.current !== u.id) {
          hydratedRef.current = u.id;
          const isCurrent = () => mounted && hydratedRef.current === u.id;
          void import("@/lib/sync-layer")
            .then(({ hydrateFromCloud }) => hydrateFromCloud(u.id, isCurrent))
            .then(() => {
              if (isCurrent()) void flushQueueAfterLogin(u.id);
            })
            .catch(() => {});
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
          const isCurrent = () => mounted && hydratedRef.current === u.id;
          void import("@/lib/sync-layer")
            .then(({ hydrateFromCloud }) => hydrateFromCloud(u.id, isCurrent))
            .then(() => {
              if (isCurrent()) void flushQueueAfterLogin(u.id);
            })
            .catch(() => {});
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
