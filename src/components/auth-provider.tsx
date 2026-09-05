"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getSupabaseBrowser, hasSupabaseEnv } from "@/lib/supabase/client";
import { setAuthState, hydrateFromCloud } from "@/lib/sync-layer";
import { flushPersistedQueue } from "@/lib/sync-queue-store";
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

    client.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (!mounted) return;
      const u = session?.user;
      if (u) {
        setUser({ id: u.id, email: u.email ?? null });
        setAuthState(true, u.id);
        // 页面刷新后已有会话：补一次 hydrate（若未做过）；完成后 flush 离线写队列
        if (hydratedRef.current !== u.id) {
          hydratedRef.current = u.id;
          void hydrateFromCloud(u.id).then(() => {
            void flushPersistedQueue(buildQueueExecutor(u.id));
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
          void hydrateFromCloud(u.id).then(() => {
            void flushPersistedQueue(buildQueueExecutor(u.id));
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
      void flushPersistedQueue(buildQueueExecutor(uid));
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


/**
 * R9.5：把队列条目映射到对应的 Supabase 写操作。
 * 登录态失效时 executor 永远返回 false（保留条目等下次登录）。
 */
function buildQueueExecutor(uid: string) {
  return async (item: import("@/lib/sync-queue").QueueItem): Promise<boolean> => {
    try {
      const sb = getSupabaseBrowser();
      switch (item.kind) {
        case "progress": {
          const { chapter_num, doc_slug } = item.payload as { chapter_num: string; doc_slug: string };
          const { error } = await sb.from("progress").upsert(
            { user_id: uid, chapter_num, doc_slug },
            { onConflict: "user_id,chapter_num,doc_slug" },
          );
          return !error;
        }
        case "wrongbook-upsert": {
          const { chapter_num, question_idx, picked, srs_stage, srs_due } = item.payload as {
            chapter_num: string; question_idx: number; picked: number;
            srs_stage: number | null; srs_due: string | null;
          };
          const { error } = await sb.from("wrongbook").upsert(
            { user_id: uid, chapter_num, question_idx, picked, srs_stage, srs_due },
            { onConflict: "user_id,chapter_num,question_idx" },
          );
          return !error;
        }
        case "wrongbook-delete": {
          const { chapter_num, question_idx } = item.payload as {
            chapter_num: string; question_idx: number;
          };
          const { error } = await sb.from("wrongbook")
            .delete()
            .eq("user_id", uid)
            .eq("chapter_num", chapter_num)
            .eq("question_idx", question_idx);
          return !error;
        }
        case "quiz": {
          const { chapter_num, best, total } = item.payload as {
            chapter_num: string; best: number; total: number;
          };
          const { error } = await sb.from("quiz_scores").upsert(
            { user_id: uid, chapter_num, best, total, done: true },
            { onConflict: "user_id,chapter_num" },
          );
          return !error;
        }
        case "replay-history": {
          const { symbol, interval, total, correct, best_streak } = item.payload as {
            symbol: string; interval: string; total: number; correct: number; best_streak: number;
          };
          const { error } = await sb.from("replay_history").insert({
            user_id: uid, symbol, interval, total, correct, best_streak,
          });
          return !error;
        }
        case "replay-best": {
          const { best_streak } = item.payload as { best_streak: number };
          const { error } = await sb.from("replay_best").upsert(
            { user_id: uid, best_streak },
            { onConflict: "user_id" },
          );
          return !error;
        }
        case "goal": {
          const { daily_goal_min } = item.payload as { daily_goal_min: number };
          const { error } = await sb.from("user_settings").upsert(
            { user_id: uid, daily_goal_min },
            { onConflict: "user_id" },
          );
          return !error;
        }
        default:
          return false;
      }
    } catch {
      return false;
    }
  };
}
