"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { setAuthState } from "@/lib/sync-layer";
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

  useEffect(() => {
    let mounted = true;
    // 挂载时取当前会话
    getSupabaseBrowser().auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (!mounted) return;
      const u = session?.user;
      if (u) {
        setUser({ id: u.id, email: u.email ?? null });
        setAuthState(true, u.id);
      }
    });
    // 监听登录/登出
    const { data: sub } = getSupabaseBrowser().auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      const u = session?.user;
      if (u) {
        setUser({ id: u.id, email: u.email ?? null });
        setAuthState(true, u.id);
      } else {
        setUser(null);
        setAuthState(false);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}
