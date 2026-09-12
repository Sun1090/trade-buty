"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { QueueItem } from "./sync-queue";

/**
 * R9.5：把队列条目映射到对应的 Supabase 写操作。
 * 独立成模块 → 只有登录后 + flushPersistedQueue 调用方才需要，理论上可被切到独立 chunk。
 * 调用方传 uid；任何表操作返回 {error} 时视作失败（保留条目）。
 */
export function buildQueueExecutor(uid: string) {
  return async (item: QueueItem): Promise<boolean> => {
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
          const payload = item.payload as { daily_goal_min?: number; weekly_goal_min?: number };
          // 具名行类型而非泛化 Record：泛化类型在更严格的 TS 下会被 Supabase upsert 重载拒绝。
          const row: { user_id: string; daily_goal_min?: number; weekly_goal_min?: number } = {
            user_id: uid,
          };
          if (typeof payload.daily_goal_min === "number") row.daily_goal_min = payload.daily_goal_min;
          if (typeof payload.weekly_goal_min === "number") row.weekly_goal_min = payload.weekly_goal_min;
          const { error } = await sb.from("user_settings").upsert(row, { onConflict: "user_id" });
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
