"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./supabase-env";

/** 浏览器端 Supabase 客户端（anon key，受 RLS 约束） */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
